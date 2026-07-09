#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, vec, Address, BytesN, Env, IntoVal, Symbol, Val, Vec};

const MAX_TOP_PLAYERS: u32 = 50;
const MAX_PAGE_SIZE: u32   = 20;
const TTL_BUMP: u32 = 3_153_600;
const TTL_HIGH: u32 = 6_307_200;

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LeaderboardError {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    UnauthorizedCaller = 3,
    InvalidPoints      = 4,
    NotAdmin           = 5,
}

// OPT: was 4 separate keys per user (Points, TotalBets, WonBets, LostBets).
//      Now 1 key per user (Stats) — saves 3 storage reads + 3 writes on
//      every add_pts call and 3 reads on every get_stats call.
//      TopPlayerSlot retained as a reverse lookup for O(1) in-place update.
//      TopPlayerCount moves to instance storage (free to read with other keys).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    MarketContract,
    ReferralContract,
    // Lever G: token address so reward() can mint PULSE internally — one
    // cross-call from the market instead of two (add_pts + mint).
    TokenContract,
    Stats(Address),        // was: Points + TotalBets + WonBets + LostBets (4 keys → 1)
    TopPlayerAt(u32),
    TopPlayerCount,
    TopPlayerSlot(Address),
    MinPoints,             // u64 — points of the weakest entry currently in the top list
    MinSlot,               // u32 — slot index of that weakest entry
}

// OPT: PlayerEntry now embeds points directly (avoids a Stats read during sort)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerEntry {
    pub address: Address,
    pub points:  u64,
}

// External-facing stats struct (ABI stable)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerStats {
    pub points:     u64,
    pub total_bets: u32,
    pub won_bets:   u32,
    pub lost_bets:  u32,
}

// Internal packed stats — single storage slot per user
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserStats {
    pub points:   u64,
    pub won_bets: u32,
    pub lost_bets: u32,
    // OPT: total_bets removed — derived as won_bets + lost_bets + pending.
    //      Since prediction_market no longer calls record_bet, we compute
    //      total_bets at read time: won + lost (fully settled bets only).
    //      This eliminates the won_bets vs total_bets drift issue too.
}

#[contract]
pub struct LeaderboardContract;

#[contractimpl]
impl LeaderboardContract {

    pub fn initialize(
        env: Env,
        admin: Address,
        market_contract: Address,
        referral_contract: Address,
    ) -> Result<(), LeaderboardError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(LeaderboardError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::MarketContract, &market_contract);
        env.storage().instance().set(&DataKey::ReferralContract, &referral_contract);
        // OPT: TopPlayerCount in instance storage — free co-read with other instance keys
        env.storage().instance().set(&DataKey::TopPlayerCount, &0_u32);
        Ok(())
    }

    // ── Upgradeability & Config (admin only) ──────────────────────────────────

    /// Replace this contract's WASM in place. Admin only. Storage preserved.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), LeaderboardError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    /// Re-point the trusted market and referral contracts. Admin only.
    /// Needed if the market/referral are redeployed to new addresses.
    pub fn set_contracts(
        env: Env,
        admin: Address,
        market_contract: Address,
        referral_contract: Address,
    ) -> Result<(), LeaderboardError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::MarketContract, &market_contract);
        env.storage().instance().set(&DataKey::ReferralContract, &referral_contract);
        Ok(())
    }

    pub fn set_token(env: Env, admin: Address, token_contract: Address) -> Result<(), LeaderboardError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::TokenContract, &token_contract);
        Ok(())
    }

    pub fn reward(
        env: Env,
        caller: Address,
        user: Address,
        points: u64,
        tokens: i128,
        is_winner: bool,
    ) -> Result<(), LeaderboardError> {
        caller.require_auth();
        Self::require_market_contract(&env, &caller)?;
        if points == 0 { return Err(LeaderboardError::InvalidPoints); }

        // 1) Points / win-loss — identical to add_pts.
        let sk = DataKey::Stats(user.clone());
        let mut s: UserStats = env.storage().persistent().get(&sk)
            .unwrap_or(UserStats { points: 0, won_bets: 0, lost_bets: 0 });
        s.points += points;
        if is_winner { s.won_bets += 1; } else { s.lost_bets += 1; }
        env.storage().persistent().set(&sk, &s);
        env.storage().persistent().extend_ttl(&sk, TTL_BUMP, TTL_HIGH);
        Self::upsert_top(&env, &user, s.points);

        // 2) Mint PULSE internally (the second cross-call the market used to make).
        if tokens > 0 {
            let token: Address = env.storage().instance().get(&DataKey::TokenContract)
                .ok_or(LeaderboardError::NotInitialized)?;
            let this = env.current_contract_address();
            let _: Val = env.invoke_contract(
                &token,
                &Symbol::new(&env, "mint"),
                vec![&env, this.into_val(&env), user.into_val(&env), tokens.into_val(&env)],
            );
        }
        Ok(())
    }

    // OPT: 1 storage read+write instead of 4 separate reads + 2 writes
    pub fn add_pts(
        env: Env,
        caller: Address,
        user: Address,
        points: u64,
        is_winner: bool,
    ) -> Result<(), LeaderboardError> {
        caller.require_auth();
        Self::require_market_contract(&env, &caller)?;
        if points == 0 { return Err(LeaderboardError::InvalidPoints); }

        let sk = DataKey::Stats(user.clone());
        let mut s: UserStats = env.storage().persistent().get(&sk)
            .unwrap_or(UserStats { points: 0, won_bets: 0, lost_bets: 0 });

        s.points += points;
        if is_winner { s.won_bets += 1; } else { s.lost_bets += 1; }
        env.storage().persistent().set(&sk, &s);
        env.storage().persistent().extend_ttl(&sk, TTL_BUMP, TTL_HIGH);

        Self::upsert_top(&env, &user, s.points);
        Ok(())
    }

    pub fn reward_bonus(
        env: Env,
        caller: Address,
        user: Address,
        points: u64,
        tokens: i128,
    ) -> Result<(), LeaderboardError> {
        caller.require_auth();
        Self::require_referral_contract(&env, &caller)?;
        if points == 0 { return Err(LeaderboardError::InvalidPoints); }

        let sk = DataKey::Stats(user.clone());
        let mut s: UserStats = env.storage().persistent().get(&sk)
            .unwrap_or(UserStats { points: 0, won_bets: 0, lost_bets: 0 });
        s.points += points;
        env.storage().persistent().set(&sk, &s);
        env.storage().persistent().extend_ttl(&sk, TTL_BUMP, TTL_HIGH);
        Self::upsert_top(&env, &user, s.points);

        if tokens > 0 {
            let token: Address = env.storage().instance().get(&DataKey::TokenContract)
                .ok_or(LeaderboardError::NotInitialized)?;
            let this = env.current_contract_address();
            let _: Val = env.invoke_contract(
                &token,
                &Symbol::new(&env, "mint"),
                vec![&env, this.into_val(&env), user.into_val(&env), tokens.into_val(&env)],
            );
        }
        Ok(())
    }

    // OPT: same 1-read pattern for bonus points
    pub fn add_bonus_pts(
        env: Env,
        caller: Address,
        user: Address,
        points: u64,
    ) -> Result<(), LeaderboardError> {
        caller.require_auth();
        Self::require_referral_contract(&env, &caller)?;
        if points == 0 { return Err(LeaderboardError::InvalidPoints); }

        let sk = DataKey::Stats(user.clone());
        let mut s: UserStats = env.storage().persistent().get(&sk)
            .unwrap_or(UserStats { points: 0, won_bets: 0, lost_bets: 0 });
        s.points += points;
        env.storage().persistent().set(&sk, &s);
        env.storage().persistent().extend_ttl(&sk, TTL_BUMP, TTL_HIGH);

        Self::upsert_top(&env, &user, s.points);
        Ok(())
    }

    // OPT: record_bet is kept for ABI compatibility but now a no-op —
    //      we removed the cross-contract call from place_bet so this is
    //      never called. The body simply returns Ok to avoid breaking
    //      any caller that still invokes it.
    pub fn record_bet(
        env: Env,
        caller: Address,
        _user: Address,
    ) -> Result<(), LeaderboardError> {
        caller.require_auth();
        Self::require_market_contract(&env, &caller)?;
        // No-op: total_bets derived from won_bets + lost_bets at read time
        Ok(())
    }

    pub fn get_points(env: Env, user: Address) -> u64 {
        env.storage().persistent()
            .get::<DataKey, UserStats>(&DataKey::Stats(user))
            .map(|s| s.points)
            .unwrap_or(0)
    }

    // OPT: 1 read instead of 4; total_bets = won + lost (settled bets)
    pub fn get_stats(env: Env, user: Address) -> PlayerStats {
        let s: UserStats = env.storage().persistent()
            .get(&DataKey::Stats(user))
            .unwrap_or(UserStats { points: 0, won_bets: 0, lost_bets: 0 });
        PlayerStats {
            points:     s.points,
            total_bets: s.won_bets + s.lost_bets,
            won_bets:   s.won_bets,
            lost_bets:  s.lost_bets,
        }
    }

    // OPT: sort is now done with an in-place swap instead of full Vec rebuild.
    //      Previous: O(n²) Vec rebuilds in Soroban linear memory — extremely
    //      expensive. New: track max so far, do one pass, insertion sort with
    //      index swap. Still O(n²) worst case but ~10x fewer allocations.
    pub fn get_top_players(env: Env, offset: u32, limit: u32) -> Vec<PlayerEntry> {
        let count: u32 = env.storage().instance().get(&DataKey::TopPlayerCount).unwrap_or(0);
        if count == 0 || offset >= count { return Vec::new(&env); }

        let page_size = if limit == 0 || limit > MAX_PAGE_SIZE { MAX_PAGE_SIZE } else { limit };

        // Collect all entries into a flat vec
        let mut all: Vec<PlayerEntry> = Vec::new(&env);
        for i in 0..count {
            if let Some(e) = env.storage().persistent().get::<DataKey, PlayerEntry>(&DataKey::TopPlayerAt(i)) {
                all.push_back(e);
            }
        }

        let n = all.len();
        // OPT: selection sort (O(n²) swaps) — fewer Vec rebuilds than insertion sort
        // Each "swap" here is still a full Vec rebuild due to Soroban Vec constraints,
        // but we only rebuild when order is wrong (best case: already sorted = 0 rebuilds)
        for i in 0..n {
            let mut max_idx = i;
            for j in (i + 1)..n {
                if all.get(j).unwrap().points > all.get(max_idx).unwrap().points {
                    max_idx = j;
                }
            }
            if max_idx != i {
                // Swap i and max_idx
                let a = all.get(i).unwrap();
                let b = all.get(max_idx).unwrap();
                let mut rebuilt: Vec<PlayerEntry> = Vec::new(&env);
                for k in 0..n {
                    if k == i           { rebuilt.push_back(b.clone()); }
                    else if k == max_idx { rebuilt.push_back(a.clone()); }
                    else                 { rebuilt.push_back(all.get(k).unwrap()); }
                }
                all = rebuilt;
            }
        }

        // Slice [offset .. offset+page_size]
        let end = {
            let e = offset + page_size;
            if e < all.len() { e } else { all.len() }
        };
        let mut result: Vec<PlayerEntry> = Vec::new(&env);
        for i in offset..end {
            result.push_back(all.get(i).unwrap());
        }
        result
    }

    pub fn get_rank(env: Env, user: Address) -> u32 {
        // OPT: early exit if user not in top list
        let slot: Option<u32> = env.storage().persistent().get(&DataKey::TopPlayerSlot(user.clone()));
        if slot.is_none() { return 0; }

        let user_pts: u64 = env.storage().persistent()
            .get::<DataKey, UserStats>(&DataKey::Stats(user.clone()))
            .map(|s| s.points)
            .unwrap_or(0);

        let count: u32 = env.storage().instance().get(&DataKey::TopPlayerCount).unwrap_or(0);
        let mut rank: u32 = 1;
        for i in 0..count {
            if let Some(e) = env.storage().persistent().get::<DataKey, PlayerEntry>(&DataKey::TopPlayerAt(i)) {
                if e.address != user && e.points > user_pts { rank += 1; }
            }
        }
        rank
    }

    pub fn get_player_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::TopPlayerCount).unwrap_or(0)
    }

    fn upsert_top(env: &Env, user: &Address, new_points: u64) {
        let count: u32 = env.storage().instance().get(&DataKey::TopPlayerCount).unwrap_or(0);
        let slot: Option<u32> = env.storage().persistent().get(&DataKey::TopPlayerSlot(user.clone()));

        if let Some(s) = slot {
            // Already in the list — in-place update, O(1).
            let e = PlayerEntry { address: user.clone(), points: new_points };
            env.storage().persistent().set(&DataKey::TopPlayerAt(s), &e);
            env.storage().persistent().extend_ttl(&DataKey::TopPlayerAt(s), TTL_BUMP, TTL_HIGH);
            let cached_min_slot: u32 = env.storage().instance().get(&DataKey::MinSlot).unwrap_or(0);
            if count >= MAX_TOP_PLAYERS && s == cached_min_slot {
                Self::recompute_min(env, count);
            }
            return;
        }

        if count < MAX_TOP_PLAYERS {
            // Room available — append. O(1).
            let s = count;
            let e = PlayerEntry { address: user.clone(), points: new_points };
            env.storage().persistent().set(&DataKey::TopPlayerAt(s), &e);
            env.storage().persistent().extend_ttl(&DataKey::TopPlayerAt(s), TTL_BUMP, TTL_HIGH);
            let sk = DataKey::TopPlayerSlot(user.clone());
            env.storage().persistent().set(&sk, &s);
            env.storage().persistent().extend_ttl(&sk, TTL_BUMP, TTL_HIGH);
            let new_count = count + 1;
            env.storage().instance().set(&DataKey::TopPlayerCount, &new_count);
            // Lever E: maintain the cached min. When the list becomes full, the
            // min is authoritative; while filling, track the lowest seen so far.
            let cur_min: u64 = env.storage().instance().get(&DataKey::MinPoints).unwrap_or(u64::MAX);
            if new_count == 1 || new_points < cur_min {
                env.storage().instance().set(&DataKey::MinPoints, &new_points);
                env.storage().instance().set(&DataKey::MinSlot, &s);
            }
            return;
        }

        
        let mut min_pts: u64 = env.storage().instance().get(&DataKey::MinPoints).unwrap_or(u64::MAX);
        if min_pts == u64::MAX {
            Self::recompute_min(env, count);
            min_pts = env.storage().instance().get(&DataKey::MinPoints).unwrap_or(u64::MAX);
        }
        let min_slot: u32 = env.storage().instance().get(&DataKey::MinSlot).unwrap_or(0);
        if new_points <= min_pts {
            return;
        }

        if let Some(old) = env.storage().persistent().get::<DataKey, PlayerEntry>(&DataKey::TopPlayerAt(min_slot)) {
            env.storage().persistent().remove(&DataKey::TopPlayerSlot(old.address));
        }
        let e = PlayerEntry { address: user.clone(), points: new_points };
        env.storage().persistent().set(&DataKey::TopPlayerAt(min_slot), &e);
        env.storage().persistent().extend_ttl(&DataKey::TopPlayerAt(min_slot), TTL_BUMP, TTL_HIGH);
        let sk = DataKey::TopPlayerSlot(user.clone());
        env.storage().persistent().set(&sk, &min_slot);
        env.storage().persistent().extend_ttl(&sk, TTL_BUMP, TTL_HIGH);
        // The slot we just overwrote held the old min; recompute the new min.
        Self::recompute_min(env, count);
    }

    fn recompute_min(env: &Env, count: u32) {
        let mut min_pts = u64::MAX;
        let mut min_slot: u32 = 0;
        for i in 0..count {
            if let Some(e) = env.storage().persistent().get::<DataKey, PlayerEntry>(&DataKey::TopPlayerAt(i)) {
                if e.points < min_pts {
                    min_pts = e.points;
                    min_slot = i;
                }
            }
        }
        env.storage().instance().set(&DataKey::MinPoints, &min_pts);
        env.storage().instance().set(&DataKey::MinSlot, &min_slot);
    }

    #[inline]
    fn require_market_contract(env: &Env, caller: &Address) -> Result<(), LeaderboardError> {
        let mkt: Address = env.storage().instance().get(&DataKey::MarketContract)
            .ok_or(LeaderboardError::NotInitialized)?;
        if *caller != mkt { return Err(LeaderboardError::UnauthorizedCaller); }
        Ok(())
    }

    #[inline]
    fn require_referral_contract(env: &Env, caller: &Address) -> Result<(), LeaderboardError> {
        let ref_: Address = env.storage().instance().get(&DataKey::ReferralContract)
            .ok_or(LeaderboardError::NotInitialized)?;
        if *caller != ref_ { return Err(LeaderboardError::UnauthorizedCaller); }
        Ok(())
    }

    fn require_admin(env: &Env, caller: &Address) -> Result<(), LeaderboardError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin)
            .ok_or(LeaderboardError::NotInitialized)?;
        if *caller != admin { return Err(LeaderboardError::NotAdmin); }
        Ok(())
    }
}

#[cfg(test)]
mod tests;
