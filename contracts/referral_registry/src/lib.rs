#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, vec,
    Address, BytesN, Env, IntoVal, String, Symbol, Val,
};

const WELCOME_BONUS_POINTS: u64 = 5;
const WELCOME_BONUS_TOKENS: i128 = 1_0000000;
const REFERRAL_BET_POINTS: u64 = 3;

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ReferralError {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    UnauthorizedCaller = 3,
    AlreadyRegistered  = 4,
    SelfReferral       = 5,
    NotAdmin           = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    MarketContract,
    // ── Legacy per-user keys (pre-Lever-A) — still READ for users who
    //    registered before the upgrade. New registrations no longer write these.
    Referrer(Address),
    DisplayName(Address),
    Registered(Address),
    // ── Lever A: one packed entry per NEW registrant (display_name + referrer).
    //    Existence of this key implies "registered". Cuts a first-time
    //    registration from 3 new entries to 1.
    Profile(Address),
    // ReferralCount/Earnings are the REFERRER's counters (a different user),
    // updated in place — kept as separate keys (not part of the registrant pack).
    ReferralCount(Address),
    ReferralEarnings(Address),
    TokenContract,
    LeaderboardContract,
    XlmSacContract,
}

// Lever A: packed registrant profile — one storage slot instead of three.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserProfile {
    pub display_name: String,
    pub referrer:     Option<Address>,
}

#[contract]
pub struct ReferralRegistryContract;

#[contractimpl]
impl ReferralRegistryContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        market_contract: Address,
        token_contract: Address,
        leaderboard_contract: Address,
        xlm_sac: Address,
    ) -> Result<(), ReferralError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ReferralError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::MarketContract, &market_contract);
        env.storage().instance().set(&DataKey::TokenContract, &token_contract);
        env.storage().instance().set(&DataKey::LeaderboardContract, &leaderboard_contract);
        env.storage().instance().set(&DataKey::XlmSacContract, &xlm_sac);
        Ok(())
    }

    // ── Upgradeability & Config (admin only) ──────────────────────────────────

    /// Replace this contract's WASM bytecode in place. Admin only.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), ReferralError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    /// Correct the native XLM SAC address set at initialize time. Admin only.
    pub fn set_xlm_sac(env: Env, admin: Address, xlm_sac: Address) -> Result<(), ReferralError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::XlmSacContract, &xlm_sac);
        Ok(())
    }

    pub fn register_referral(
        env: Env,
        user: Address,
        display_name: String,
        referrer: Option<Address>,
    ) -> Result<(), ReferralError> {
        user.require_auth();
        if Self::is_registered(env.clone(), user.clone()) {
            return Err(ReferralError::AlreadyRegistered);
        }
        if let Some(ref ref_addr) = referrer {
            if *ref_addr == user {
                return Err(ReferralError::SelfReferral);
            }
        }
        // Lever A: write ONE packed Profile entry (display_name + referrer)
        // instead of the three legacy keys (Registered + DisplayName + Referrer).
        // Existence of Profile(user) is what is_registered() now checks.
        env.storage().persistent().set(
            &DataKey::Profile(user.clone()),
            &UserProfile { display_name, referrer: referrer.clone() },
        );
        // The referrer's counter is a DIFFERENT user's entry — update in place.
        if let Some(ref ref_addr) = referrer {
            let count: u32 = env.storage().persistent()
                .get(&DataKey::ReferralCount(ref_addr.clone())).unwrap_or(0);
            env.storage().persistent()
                .set(&DataKey::ReferralCount(ref_addr.clone()), &(count + 1));
        }

        let this = env.current_contract_address();
        let leaderboard: Address = env.storage().instance().get(&DataKey::LeaderboardContract).unwrap();
        let _: Val = env.invoke_contract(
            &leaderboard,
            &Symbol::new(&env, "reward_bonus"),
            vec![&env,
                this.into_val(&env),
                user.into_val(&env),
                WELCOME_BONUS_POINTS.into_val(&env),
                WELCOME_BONUS_TOKENS.into_val(&env),
            ],
        );
        Ok(())
    }

    pub fn credit(
        env: Env,
        caller: Address,
        user: Address,
        referral_fee: i128,
    ) -> Result<bool, ReferralError> {
        caller.require_auth();
        Self::require_market_contract(&env, &caller)?;
        // Lever A: resolve referrer via packed Profile (new) or legacy key (old).
        let referrer: Option<Address> = Self::load_profile(&env, &user).and_then(|p| p.referrer);
        match referrer {
            Some(ref_addr) => {
                let xlm_sac: Address = env.storage().instance().get(&DataKey::XlmSacContract).unwrap();
                token::Client::new(&env, &xlm_sac).transfer(
                    &env.current_contract_address(), &ref_addr, &referral_fee,
                );
                let leaderboard: Address = env.storage().instance().get(&DataKey::LeaderboardContract).unwrap();
                let _: Val = env.invoke_contract(
                    &leaderboard,
                    &Symbol::new(&env, "add_bonus_pts"),
                    vec![&env, env.current_contract_address().into_val(&env), ref_addr.clone().into_val(&env), REFERRAL_BET_POINTS.into_val(&env)],
                );
                let earnings: i128 = env.storage().persistent()
                    .get(&DataKey::ReferralEarnings(ref_addr.clone())).unwrap_or(0);
                env.storage().persistent()
                    .set(&DataKey::ReferralEarnings(ref_addr), &(earnings + referral_fee));
                Ok(true)
            }
            None => {
                if referral_fee > 0 {
                    let xlm_sac: Address = env.storage().instance().get(&DataKey::XlmSacContract).unwrap();
                    token::Client::new(&env, &xlm_sac).transfer(
                        &env.current_contract_address(), &caller, &referral_fee,
                    );
                }
                Ok(false)
            }
        }
    }

 
    fn load_profile(env: &Env, user: &Address) -> Option<UserProfile> {
        if let Some(p) = env.storage().persistent()
            .get::<DataKey, UserProfile>(&DataKey::Profile(user.clone())) {
            return Some(p);
        }
        // Legacy fallback: reconstruct a profile from the old keys.
        if env.storage().persistent().get::<DataKey, bool>(&DataKey::Registered(user.clone())).unwrap_or(false) {
            let display_name = env.storage().persistent()
                .get(&DataKey::DisplayName(user.clone()))
                .unwrap_or_else(|| String::from_str(env, ""));
            let referrer = env.storage().persistent().get(&DataKey::Referrer(user.clone()));
            return Some(UserProfile { display_name, referrer });
        }
        None
    }

    pub fn get_referrer(env: Env, user: Address) -> Option<Address> {
        Self::load_profile(&env, &user).and_then(|p| p.referrer)
    }

    pub fn get_display_name(env: Env, user: Address) -> String {
        Self::load_profile(&env, &user)
            .map(|p| p.display_name)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn get_referral_count(env: Env, user: Address) -> u32 {
        env.storage().persistent().get(&DataKey::ReferralCount(user)).unwrap_or(0)
    }

    pub fn get_earnings(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::ReferralEarnings(user)).unwrap_or(0)
    }

    pub fn has_referrer(env: Env, user: Address) -> bool {
        Self::get_referrer(env, user).is_some()
    }

    pub fn is_registered(env: Env, user: Address) -> bool {
        Self::load_profile(&env, &user).is_some()
    }

    fn require_market_contract(env: &Env, caller: &Address) -> Result<(), ReferralError> {
        let market: Address = env.storage().instance().get(&DataKey::MarketContract)
            .ok_or(ReferralError::NotInitialized)?;
        if *caller != market {
            return Err(ReferralError::UnauthorizedCaller);
        }
        Ok(())
    }

    fn require_admin(env: &Env, caller: &Address) -> Result<(), ReferralError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin)
            .ok_or(ReferralError::NotInitialized)?;
        if *caller != admin {
            return Err(ReferralError::NotAdmin);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests;
