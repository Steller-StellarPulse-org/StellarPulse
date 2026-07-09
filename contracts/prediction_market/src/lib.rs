#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, vec,
    Address, BytesN, Env, IntoVal, String, Symbol, Val, Vec,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_BET: i128 = 10_000_000; // 1 XLM in stroops

const MAX_BETS_PER_USER: u32 = 20;
const MAX_MARKETS_PER_HOUR: u32 = 10;

// Fee constants — multiply before divide to avoid precision loss
const TOTAL_FEE_BPS: i128 = 200;
const PLATFORM_FEE_BPS: i128 = 150;
const BPS_DENOM: i128 = 10_000;
const NET_NUMERATOR: i128 = 9_800;

const WIN_POINTS: u64 = 30;
const LOSE_POINTS: u64 = 10;
const WIN_TOKENS: i128 = 10_0000000;
const LOSE_TOKENS: i128 = 2_0000000;

// TTL: ~1yr threshold, ~2yr extend (mainnet: ~1 ledger/5s)
const TTL_BUMP: u32 = 3_153_600;
const TTL_HIGH: u32 = 6_307_200;

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MarketError {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    NotAdmin           = 3,
    MarketNotFound     = 4,
    MarketExpired      = 5,
    MarketNotExpired   = 6,
    MarketResolved     = 7,
    MarketCancelled    = 8,
    MarketNotResolved  = 9,
    BetTooSmall        = 10,
    OppositeSideBet    = 11,
    AlreadyClaimed     = 12,
    NoBetFound         = 13,
    InvalidAmount      = 14,
    NoFeesToWithdraw   = 15,
    NotResolver        = 16,
    TooManyBets        = 17,
    NotAuthorized      = 18,
    MarketNotCancelled = 19,
    RateLimitExceeded  = 20,
}

// ── Storage Keys ──────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    // Config addresses — all in instance storage (shared, cheap)
    Cfg,                   // single packed Config struct — 1 read instead of 5
    MarketCount,
    AccumulatedFees,
    Market(u64),
    Bet(u64, Address),     // net + gross + count packed; see BetEntry
    BettorCount(u64),
    BettorAt(u64, u32),
    Resolver(Address),
    FeeRecipient(Address),
    HasReferrer(Address),
    RateWindow,            // packed u64: high32=window_start_hi, low32=count
}

// ── Config packed into one instance storage slot ───────────────────────────
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub token:      Address,
    pub referral:   Address,
    pub leaderboard: Address,
    pub xlm_sac:    Address,
}

// ── BetEntry: Bet + Gross + BetCount in one slot ──────────────────────────
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BetEntry {
    pub net:     i128, // post-fee amount bet (used for payout)
    pub gross:   i128, // pre-fee amount sent (used for cancel_refund)
    pub is_yes:  bool,
    pub claimed: bool,
    pub count:   u32,  // how many times this user has bet on this market
}

// ── Domain Structs ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Category {
    Crypto,
    Sports,
    Politics,
    Entertainment,
    Science,
    Other,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Market {
    pub id:        u64,
    pub question:  String,
    pub image_url: String,
    pub category:  Category,
    pub end_time:  u64,
    pub total_yes: i128,
    pub total_no:  i128,
    pub resolved:  bool,
    pub outcome:   bool,
    pub cancelled: bool,
    pub creator:   Address,
    pub bet_count: u32,
}

// Kept for ABI compatibility — frontend reads Bet fields
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bet {
    pub amount:  i128,
    pub is_yes:  bool,
    pub claimed: bool,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct PredictionMarketContract;

#[contractimpl]
impl PredictionMarketContract {

    pub fn initialize(
        env: Env,
        admin: Address,
        token_contract: Address,
        referral_contract: Address,
        leaderboard_contract: Address,
        xlm_sac: Address,
    ) -> Result<(), MarketError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(MarketError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        // OPT: pack all 4 contract addresses into one slot
        env.storage().instance().set(&DataKey::Cfg, &Config {
            token: token_contract,
            referral: referral_contract,
            leaderboard: leaderboard_contract,
            xlm_sac,
        });
        env.storage().instance().set(&DataKey::MarketCount, &0_u64);
        env.storage().instance().set(&DataKey::AccumulatedFees, &0_i128);
        Ok(())
    }

    // ── Upgradeability & Config (admin only) ──────────────────────────────────
    // Allows fixing a bad config (e.g. wrong XLM SAC) or shipping a bug fix
    // without redeploying and losing all markets/bets/contract address.

    /// Replace this contract's WASM bytecode in place. Admin only.
    /// Storage is preserved — only the executable changes.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), MarketError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    /// Update the packed Config (token / referral / leaderboard / xlm_sac). Admin only.
    /// Used to correct an address set at initialize time.
    pub fn set_config(
        env: Env,
        admin: Address,
        token_contract: Address,
        referral_contract: Address,
        leaderboard_contract: Address,
        xlm_sac: Address,
    ) -> Result<(), MarketError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Cfg, &Config {
            token: token_contract,
            referral: referral_contract,
            leaderboard: leaderboard_contract,
            xlm_sac,
        });
        Ok(())
    }

    /// Read the current Config (for verification/admin tooling).
    pub fn get_config(env: Env) -> Config {
        env.storage().instance().get(&DataKey::Cfg).unwrap()
    }

    // ── Resolver Management ───────────────────────────────────────────────

    pub fn add_resolver(env: Env, admin: Address, resolver: Address) -> Result<(), MarketError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        let key = DataKey::Resolver(resolver);
        env.storage().persistent().set(&key, &true);
        env.storage().persistent().extend_ttl(&key, TTL_BUMP, TTL_HIGH);
        Ok(())
    }

    pub fn remove_resolver(env: Env, admin: Address, resolver: Address) -> Result<(), MarketError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        env.storage().persistent().remove(&DataKey::Resolver(resolver));
        Ok(())
    }

    pub fn is_resolver(env: Env, resolver: Address) -> bool {
        env.storage().persistent().get(&DataKey::Resolver(resolver)).unwrap_or(false)
    }

    // ── Fee Recipient Management ──────────────────────────────────────────

    pub fn add_fee_recipient(env: Env, admin: Address, recipient: Address) -> Result<(), MarketError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        let key = DataKey::FeeRecipient(recipient);
        env.storage().persistent().set(&key, &true);
        env.storage().persistent().extend_ttl(&key, TTL_BUMP, TTL_HIGH);
        Ok(())
    }

    pub fn remove_fee_recipient(env: Env, admin: Address, recipient: Address) -> Result<(), MarketError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        env.storage().persistent().remove(&DataKey::FeeRecipient(recipient));
        Ok(())
    }

    // ── Market Management ─────────────────────────────────────────────────

    pub fn create_market(
        env: Env,
        admin: Address,
        question: String,
        image_url: String,
        category: Category,
        duration_secs: u64,
    ) -> Result<u64, MarketError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();
        Self::check_rate(&env)?;

        // OPT: single instance read for count (was already one read)
        let market_id: u64 = env.storage().instance().get(&DataKey::MarketCount).unwrap_or(0) + 1;
        let end_time = env.ledger().timestamp() + duration_secs;

        let market = Market {
            id: market_id,
            question,
            image_url,
            category,
            end_time,
            total_yes: 0,
            total_no: 0,
            resolved: false,
            outcome: false,
            cancelled: false,
            creator: admin,
            bet_count: 0,
        };

        let mkt_key = DataKey::Market(market_id);
        env.storage().persistent().set(&mkt_key, &market);
        env.storage().persistent().extend_ttl(&mkt_key, TTL_BUMP, TTL_HIGH);
        // OPT: removed BettorCount write here — now written lazily on first bet
        env.storage().instance().set(&DataKey::MarketCount, &market_id);

        Ok(market_id)
    }

    // ── Betting ───────────────────────────────────────────────────────────
    pub fn place_bet(
        env: Env,
        user: Address,
        market_id: u64,
        is_yes: bool,
        amount: i128,
    ) -> Result<(), MarketError> {
        user.require_auth();

        if amount < MIN_BET {
            return Err(MarketError::BetTooSmall);
        }

        // OPT: load market first — cheapest early-exit if not found
        let mut market = Self::load_market(&env, market_id)?;
        if market.cancelled  { return Err(MarketError::MarketCancelled); }
        if market.resolved   { return Err(MarketError::MarketResolved); }
        if env.ledger().timestamp() >= market.end_time { return Err(MarketError::MarketExpired); }

        // OPT: single read for BetEntry (was 3 separate reads: Bet + BetGross + UserBetCount)
        let bet_key = DataKey::Bet(market_id, user.clone());
        let existing: Option<BetEntry> = env.storage().persistent().get(&bet_key);

        // Spam guard + side check combined from single read
        if let Some(ref e) = existing {
            if e.count >= MAX_BETS_PER_USER { return Err(MarketError::TooManyBets); }
            if e.is_yes != is_yes          { return Err(MarketError::OppositeSideBet); }
        }

        let is_increase = existing.is_some();

        // ── Fee calculation — use precomputed multipliers ─────────────────
        let total_fee    = amount * TOTAL_FEE_BPS / BPS_DENOM;
        let platform_fee = amount * PLATFORM_FEE_BPS / BPS_DENOM;
        let referral_fee = total_fee - platform_fee;
        let net          = amount * NET_NUMERATOR / BPS_DENOM;

        // OPT: one Config read instead of 4 separate instance reads
        let cfg: Config = env.storage().instance().get(&DataKey::Cfg).unwrap();

        // ── XLM transfer user → this contract ────────────────────────────
        let xlm = token::Client::new(&env, &cfg.xlm_sac);
        let this = env.current_contract_address();
        xlm.transfer(&user, &this, &amount);

        // ── Accumulated fees ──────────────────────────────────────────────
        let mut acc_fees: i128 = env.storage().instance().get(&DataKey::AccumulatedFees).unwrap_or(0);
        acc_fees += platform_fee;

        // ── Referral (skip if cached no-referrer) ─────────────────────────
        let hr_key = DataKey::HasReferrer(user.clone());
        let cached: Option<bool> = env.storage().persistent().get(&hr_key);

        let paid_referrer = if cached == Some(false) {
            false
        } else {
            xlm.transfer(&this, &cfg.referral, &referral_fee);
            let result: bool = env.invoke_contract(
                &cfg.referral,
                &Symbol::new(&env, "credit"),
                vec![&env, this.clone().into_val(&env), user.clone().into_val(&env), referral_fee.into_val(&env)],
            );
            if cached.is_none() {
                env.storage().persistent().set(&hr_key, &result);
                env.storage().persistent().extend_ttl(&hr_key, TTL_BUMP, TTL_HIGH);
            }
            result
        };

        if !paid_referrer { acc_fees += referral_fee; }
        env.storage().instance().set(&DataKey::AccumulatedFees, &acc_fees);

        // ── Write BetEntry (net + gross + count in one write) ─────────────
        let new_entry = match existing {
            Some(mut e) => { e.net += net; e.gross += amount; e.count += 1; e }
            None        => BetEntry { net, gross: amount, is_yes, claimed: false, count: 1 }
        };
        env.storage().persistent().set(&bet_key, &new_entry);
        env.storage().persistent().extend_ttl(&bet_key, TTL_BUMP, TTL_HIGH);

        // ── Bettor index (first bet only) ─────────────────────────────────
        if !is_increase {
            let cnt_key = DataKey::BettorCount(market_id);
            let count: u32 = env.storage().persistent().get(&cnt_key).unwrap_or(0);
            let slot_key = DataKey::BettorAt(market_id, count);
            // OPT: no clone — user is moved here and we don't need it after
            env.storage().persistent().set(&slot_key, &user);
            env.storage().persistent().extend_ttl(&slot_key, TTL_BUMP, TTL_HIGH);
            let new_count = count + 1;
            env.storage().persistent().set(&cnt_key, &new_count);
            env.storage().persistent().extend_ttl(&cnt_key, TTL_BUMP, TTL_HIGH);
            market.bet_count += 1;
        }

        // ── Market totals ─────────────────────────────────────────────────
        if is_yes { market.total_yes += net; } else { market.total_no += net; }
        let mkt_key = DataKey::Market(market_id);
        env.storage().persistent().set(&mkt_key, &market);
        env.storage().persistent().extend_ttl(&mkt_key, TTL_BUMP, TTL_HIGH);
        Ok(())
    }

    // ── Resolution ────────────────────────────────────────────────────────

    pub fn resolve_market(
        env: Env,
        caller: Address,
        market_id: u64,
        outcome: bool,
    ) -> Result<(), MarketError> {
        caller.require_auth();
        Self::require_admin_or_resolver(&env, &caller)?;

        let mut market = Self::load_market(&env, market_id)?;
        if market.resolved  { return Err(MarketError::MarketResolved); }
        if market.cancelled { return Err(MarketError::MarketCancelled); }
        if env.ledger().timestamp() < market.end_time { return Err(MarketError::MarketNotExpired); }

        let winning_side = if outcome { market.total_yes } else { market.total_no };
        if winning_side == 0 {
            let total_pool = market.total_yes + market.total_no;
            if total_pool > 0 {
                let mut acc: i128 = env.storage().instance()
                    .get(&DataKey::AccumulatedFees).unwrap_or(0);
                acc += total_pool;
                env.storage().instance().set(&DataKey::AccumulatedFees, &acc);
            }
        }

        market.resolved = true;
        market.outcome = outcome;
        let mkt_key = DataKey::Market(market_id);
        env.storage().persistent().set(&mkt_key, &market);
        env.storage().persistent().extend_ttl(&mkt_key, TTL_BUMP, TTL_HIGH);
        Ok(())
    }

    // ── Cancellation ──────────────────────────────────────────────────────

    pub fn cancel_market(env: Env, admin: Address, market_id: u64) -> Result<(), MarketError> {
        Self::require_admin(&env, &admin)?;
        admin.require_auth();

        let mut market = Self::load_market(&env, market_id)?;
        if market.resolved  { return Err(MarketError::MarketResolved); }
        if market.cancelled { return Err(MarketError::MarketCancelled); }

        market.cancelled = true;
        let mkt_key = DataKey::Market(market_id);
        env.storage().persistent().set(&mkt_key, &market);
        env.storage().persistent().extend_ttl(&mkt_key, TTL_BUMP, TTL_HIGH);

        // Reclaim fees — net * fee_rate / (1 - fee_rate)
        let net_pool    = market.total_yes + market.total_no;
        let fees_in_pool = net_pool * TOTAL_FEE_BPS / (BPS_DENOM - TOTAL_FEE_BPS);
        let mut acc_fees: i128 = env.storage().instance().get(&DataKey::AccumulatedFees).unwrap_or(0);
        acc_fees = if fees_in_pool < acc_fees { acc_fees - fees_in_pool } else { 0 };
        env.storage().instance().set(&DataKey::AccumulatedFees, &acc_fees);

        Ok(())
    }

    pub fn cancel_refund(env: Env, user: Address, market_id: u64) -> Result<i128, MarketError> {
        user.require_auth();

        let market = Self::load_market(&env, market_id)?;
        if !market.cancelled { return Err(MarketError::MarketNotCancelled); }

        // OPT: read BetEntry (which now contains gross) — was a separate BetGross key
        let bet_key = DataKey::Bet(market_id, user.clone());
        let mut entry: BetEntry = env.storage().persistent().get(&bet_key)
            .ok_or(MarketError::NoBetFound)?;

        if entry.gross == 0 { return Err(MarketError::NoBetFound); }

        let gross = entry.gross;
        entry.gross = 0; // idempotency guard
        env.storage().persistent().set(&bet_key, &entry);

        let cfg: Config = env.storage().instance().get(&DataKey::Cfg).unwrap();
        token::Client::new(&env, &cfg.xlm_sac)
            .transfer(&env.current_contract_address(), &user, &gross);

        Ok(gross)
    }

    // ── Claim ─────────────────────────────────────────────────────────────
    // OPT: one Config read replaces 3 separate reads (xlm_sac, leaderboard, token)

    pub fn claim(env: Env, user: Address, market_id: u64) -> Result<(), MarketError> {
        user.require_auth();

        let market = Self::load_market(&env, market_id)?;
        if market.cancelled  { return Err(MarketError::MarketCancelled); }
        if !market.resolved  { return Err(MarketError::MarketNotResolved); }

        let bet_key = DataKey::Bet(market_id, user.clone());
        let mut entry: BetEntry = env.storage().persistent().get(&bet_key)
            .ok_or(MarketError::NoBetFound)?;

        if entry.claimed { return Err(MarketError::AlreadyClaimed); }

        let is_winner = entry.is_yes == market.outcome;
        let total_pool = market.total_yes + market.total_no;
        let winning_side = if market.outcome { market.total_yes } else { market.total_no };

        // SECURITY: mark claimed BEFORE any external calls.
        entry.claimed = true;
        env.storage().persistent().set(&bet_key, &entry);
        env.storage().persistent().extend_ttl(&bet_key, TTL_BUMP, TTL_HIGH);

        let cfg: Config = env.storage().instance().get(&DataKey::Cfg).unwrap();
        let this = env.current_contract_address();

        // XLM payout: only when the winning side had bettors.
        // If winning_side == 0, the pool was swept to AccumulatedFees at resolve
        // time so the admin/fee-recipient can withdraw it via withdraw_fees().
        if is_winner && winning_side > 0 {
            let payout = (entry.net * total_pool) / winning_side;
            token::Client::new(&env, &cfg.xlm_sac).transfer(&this, &user, &payout);
        }

        // All participants earn PULSE tokens + leaderboard points regardless.
        // When winning_side == 0, "winners" receive loser-tier rewards (no competition).
        let real_win = is_winner && winning_side > 0;
        let (points, tokens): (u64, i128) = if real_win {
            (WIN_POINTS, WIN_TOKENS)
        } else {
            (LOSE_POINTS, LOSE_TOKENS)
        };

        let _: Val = env.invoke_contract(
            &cfg.leaderboard,
            &Symbol::new(&env, "reward"),
            vec![&env,
                this.clone().into_val(&env),
                user.clone().into_val(&env),
                points.into_val(&env),
                tokens.into_val(&env),
                real_win.into_val(&env),
            ],
        );

        Ok(())
    }

    // ── Withdraw Fees ─────────────────────────────────────────────────────

    pub fn withdraw_fees(env: Env, caller: Address, recipient: Address) -> Result<i128, MarketError> {
        caller.require_auth();
        Self::require_admin_or_fee_recipient(&env, &caller)?;

        let fees: i128 = env.storage().instance().get(&DataKey::AccumulatedFees).unwrap_or(0);
        if fees == 0 { return Err(MarketError::NoFeesToWithdraw); }

        let cfg: Config = env.storage().instance().get(&DataKey::Cfg).unwrap();
        token::Client::new(&env, &cfg.xlm_sac)
            .transfer(&env.current_contract_address(), &recipient, &fees);

        env.storage().instance().set(&DataKey::AccumulatedFees, &0_i128);
        Ok(fees)
    }

    // ── View Functions ────────────────────────────────────────────────────

    pub fn get_market(env: Env, market_id: u64) -> Result<Market, MarketError> {
        Self::load_market(&env, market_id)
    }

    // OPT: returns Bet (ABI-compatible) derived from BetEntry
    pub fn get_bet(env: Env, market_id: u64, user: Address) -> Result<Bet, MarketError> {
        let e: BetEntry = env.storage().persistent()
            .get(&DataKey::Bet(market_id, user))
            .ok_or(MarketError::NoBetFound)?;
        Ok(Bet { amount: e.net, is_yes: e.is_yes, claimed: e.claimed })
    }

    pub fn get_market_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::MarketCount).unwrap_or(0)
    }

    pub fn get_market_bettors(env: Env, market_id: u64) -> Result<Vec<Address>, MarketError> {
        Self::load_market(&env, market_id)?;
        let count: u32 = env.storage().persistent().get(&DataKey::BettorCount(market_id)).unwrap_or(0);
        let mut result: Vec<Address> = Vec::new(&env);
        for i in 0..count {
            if let Some(addr) = env.storage().persistent().get::<DataKey, Address>(&DataKey::BettorAt(market_id, i)) {
                result.push_back(addr);
            }
        }
        Ok(result)
    }

    pub fn get_accumulated_fees(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::AccumulatedFees).unwrap_or(0)
    }

    pub fn get_user_bet_count(env: Env, market_id: u64, user: Address) -> u32 {
        env.storage().persistent()
            .get::<DataKey, BetEntry>(&DataKey::Bet(market_id, user))
            .map(|e| e.count)
            .unwrap_or(0)
    }

    pub fn get_bet_gross(env: Env, market_id: u64, user: Address) -> i128 {
        env.storage().persistent()
            .get::<DataKey, BetEntry>(&DataKey::Bet(market_id, user))
            .map(|e| e.gross)
            .unwrap_or(0)
    }

    // ── Internal Helpers ──────────────────────────────────────────────────

    #[inline]
    fn load_market(env: &Env, market_id: u64) -> Result<Market, MarketError> {
        env.storage().persistent().get(&DataKey::Market(market_id)).ok_or(MarketError::MarketNotFound)
    }

    #[inline]
    fn require_admin(env: &Env, caller: &Address) -> Result<(), MarketError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(MarketError::NotInitialized)?;
        if *caller != admin { return Err(MarketError::NotAdmin); }
        Ok(())
    }

    fn require_admin_or_resolver(env: &Env, caller: &Address) -> Result<(), MarketError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(MarketError::NotInitialized)?;
        if *caller == admin { return Ok(()); }
        if env.storage().persistent().get(&DataKey::Resolver(caller.clone())).unwrap_or(false) {
            return Ok(());
        }
        Err(MarketError::NotResolver)
    }

    fn require_admin_or_fee_recipient(env: &Env, caller: &Address) -> Result<(), MarketError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(MarketError::NotInitialized)?;
        if *caller == admin { return Ok(()); }
        if env.storage().persistent().get(&DataKey::FeeRecipient(caller.clone())).unwrap_or(false) {
            return Ok(());
        }
        Err(MarketError::NotAuthorized)
    }

    // OPT: CreationWindow packed into two u32s stored as separate u32 keys
    // to avoid struct serialization. Actually simpler: store as (u64, u32) tuple
    // via a single key — Soroban serializes tuples efficiently.
    fn check_rate(env: &Env) -> Result<(), MarketError> {
        let now = env.ledger().timestamp();
        // (window_start, count) packed — 1 read instead of 1 struct deserialize
        let (ws, cnt): (u64, u32) = env.storage().instance()
            .get(&DataKey::RateWindow)
            .unwrap_or((now, 0));

        let (new_ws, new_cnt) = if now - ws < 3600 {
            if cnt >= MAX_MARKETS_PER_HOUR { return Err(MarketError::RateLimitExceeded); }
            (ws, cnt + 1)
        } else {
            (now, 1)
        };
        env.storage().instance().set(&DataKey::RateWindow, &(new_ws, new_cnt));
        Ok(())
    }
}

#[cfg(test)]
mod tests;
