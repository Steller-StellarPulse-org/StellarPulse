#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Env, String,
};

// Import sibling contracts for inter-contract testing
use PULSE_token::PULSETokenContract;
use leaderboard::LeaderboardContract;

// ── Test Helpers ──────────────────────────────────────────────────────────────

struct TestSetup {
    env: Env,
    client: ReferralRegistryContractClient<'static>,
    admin: Address,
    market: Address,
    token_id: Address,
    leaderboard_id: Address,
    xlm_sac_id: Address,
    referral_id: Address,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();
    env.budget().reset_unlimited();

    let admin = Address::generate(&env);
    let market = Address::generate(&env);

    // Deploy PULSEToken
    let token_id = env.register_contract(None, PULSETokenContract);
    let token_client = PULSE_token::PULSETokenContractClient::new(&env, &token_id);
    token_client.initialize(
        &admin,
        &String::from_str(&env, "PULSE"),
        &String::from_str(&env, "PLSE"),
        &7u32,
    );

    // Deploy Leaderboard
    let leaderboard_id = env.register_contract(None, LeaderboardContract);
    let leaderboard_client = leaderboard::LeaderboardContractClient::new(&env, &leaderboard_id);

    // Deploy ReferralRegistry
    let referral_id = env.register_contract(None, ReferralRegistryContract);
    let referral_client = ReferralRegistryContractClient::new(&env, &referral_id);

    // Initialize Leaderboard: market + referral as authorized callers
    leaderboard_client.initialize(&admin, &market, &referral_id);

    // Lever G: leaderboard mints the welcome bonus internally now, so it needs
    // the token address and minter authorization (mirrors mainnet upgrade).
    leaderboard_client.set_token(&admin, &token_id);
    token_client.set_minter(&leaderboard_id);
    // Legacy: referral no longer mints directly, kept harmless.
    token_client.set_minter(&referral_id);

    // Register a SAC for native XLM
    let xlm_sac_id = env.register_stellar_asset_contract(admin.clone());

    // Initialize referral registry
    referral_client.initialize(&admin, &market, &token_id, &leaderboard_id, &xlm_sac_id);

    TestSetup {
        env,
        client: referral_client,
        admin,
        market,
        token_id,
        leaderboard_id,
        xlm_sac_id,
        referral_id,
    }
}

// ── 1. Register with display name + custom referrer ───────────────────────────

#[test]
fn test_register_with_referrer() {
    let t = setup();
    let user = Address::generate(&t.env);
    let referrer = Address::generate(&t.env);

    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "CryptoKing"),
        &Some(referrer.clone()),
    );

    assert!(t.client.is_registered(&user));
    assert_eq!(t.client.get_referrer(&user), Some(referrer.clone()));
    assert!(t.client.has_referrer(&user));
    assert_eq!(t.client.get_referral_count(&referrer), 1);
}

// ── 2. Register with display name + no referrer ──────────────────────────────

#[test]
fn test_register_no_referrer() {
    let t = setup();
    let user = Address::generate(&t.env);

    let no_ref: Option<Address> = None;
    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "JustBetting"),
        &no_ref,
    );

    assert!(t.client.is_registered(&user));
    assert_eq!(t.client.get_referrer(&user), None);
    assert!(!t.client.has_referrer(&user));
}

// ── 3. Welcome bonus: 5 pts + 1 PULSE on registration ─────────────────────

#[test]
fn test_welcome_bonus() {
    let t = setup();
    let user = Address::generate(&t.env);

    let no_ref: Option<Address> = None;
    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "NewUser"),
        &no_ref,
    );

    // Leaderboard: 5 welcome points, no win/loss impact
    let lb_client = leaderboard::LeaderboardContractClient::new(&t.env, &t.leaderboard_id);
    assert_eq!(lb_client.get_points(&user), 5);
    let stats = lb_client.get_stats(&user);
    assert_eq!(stats.won_bets, 0);
    assert_eq!(stats.lost_bets, 0);

    // Token: 1 PULSE (7 decimals)
    let tok_client = PULSE_token::PULSETokenContractClient::new(&t.env, &t.token_id);
    assert_eq!(tok_client.balance(&user), 1_0000000);
}

// ── 4. Reject self-referral ──────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_reject_self_referral() {
    let t = setup();
    let user = Address::generate(&t.env);

    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "SelfRef"),
        &Some(user.clone()),
    );
}

// ── 5. Reject double registration ────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_reject_double_registration() {
    let t = setup();
    let user = Address::generate(&t.env);

    let no_ref: Option<Address> = None;
    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "First"),
        &no_ref,
    );

    // Second registration should fail
    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "Second"),
        &no_ref,
    );
}

// ── 6. Display name stored and retrievable ───────────────────────────────────

#[test]
fn test_display_name() {
    let t = setup();
    let user = Address::generate(&t.env);

    let no_ref: Option<Address> = None;
    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "CryptoKing"),
        &no_ref,
    );

    assert_eq!(
        t.client.get_display_name(&user),
        String::from_str(&t.env, "CryptoKing"),
    );

    // Unregistered user gets empty string
    let nobody = Address::generate(&t.env);
    assert_eq!(
        t.client.get_display_name(&nobody),
        String::from_str(&t.env, ""),
    );
}

// ── 7. Credit routes fee to referrer + 3 bonus points ────────────────────────

#[test]
fn test_credit_with_referrer() {
    let t = setup();
    let user = Address::generate(&t.env);
    let referrer = Address::generate(&t.env);

    // Register user with referrer
    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "BetFan"),
        &Some(referrer.clone()),
    );

    // Fund the referral contract with XLM so it can pay out
    let sac_admin = StellarAssetClient::new(&t.env, &t.xlm_sac_id);
    sac_admin.mint(&t.referral_id, &100_0000000_i128); // 100 XLM

    let referral_fee: i128 = 5_000_000; // 0.5 XLM

    // Call credit from market contract
    let result = t.client.credit(&t.market, &user, &referral_fee);
    assert!(result);

    // Referrer received the XLM
    let xlm_client = TokenClient::new(&t.env, &t.xlm_sac_id);
    assert_eq!(xlm_client.balance(&referrer), referral_fee);

    // Referrer got 3 leaderboard bonus points
    let lb_client = leaderboard::LeaderboardContractClient::new(&t.env, &t.leaderboard_id);
    assert_eq!(lb_client.get_points(&referrer), 3);

    // Earnings tracked
    assert_eq!(t.client.get_earnings(&referrer), referral_fee);
}

// ── 8. Credit returns false when no custom referrer ──────────────────────────

#[test]
fn test_credit_no_referrer() {
    let t = setup();
    let user = Address::generate(&t.env);

    // Register without referrer
    let no_ref: Option<Address> = None;
    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "Solo"),
        &no_ref,
    );

    // In real flow, prediction_market transfers referral_fee to this contract
    // before calling credit. Mirror that here.
    let sac_admin = StellarAssetClient::new(&t.env, &t.xlm_sac_id);
    sac_admin.mint(&t.referral_id, &10_0000000_i128);

    let xlm_client = TokenClient::new(&t.env, &t.xlm_sac_id);
    let market_bal_before = xlm_client.balance(&t.market);

    let result = t.client.credit(&t.market, &user, &5_000_000);
    assert!(!result);

    // Fee returned to caller (market contract)
    assert_eq!(xlm_client.balance(&t.market), market_bal_before + 5_000_000);
}

// ── 8b. Credit returns false for completely unregistered user ─────────────────

#[test]
fn test_credit_unregistered_user() {
    let t = setup();
    let user = Address::generate(&t.env);

    // In real flow, prediction_market transfers referral_fee to this contract first
    let sac_admin = StellarAssetClient::new(&t.env, &t.xlm_sac_id);
    sac_admin.mint(&t.referral_id, &10_0000000_i128);

    let xlm_client = TokenClient::new(&t.env, &t.xlm_sac_id);
    let market_bal_before = xlm_client.balance(&t.market);

    let result = t.client.credit(&t.market, &user, &5_000_000);
    assert!(!result);

    // Fee returned to caller (market contract)
    assert_eq!(xlm_client.balance(&t.market), market_bal_before + 5_000_000);
}

// ── 9. Earnings accumulation across multiple credits ─────────────────────────

#[test]
fn test_earnings_accumulation() {
    let t = setup();
    let user = Address::generate(&t.env);
    let referrer = Address::generate(&t.env);

    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "Bettor"),
        &Some(referrer.clone()),
    );

    // Fund the referral contract with XLM
    let sac_admin = StellarAssetClient::new(&t.env, &t.xlm_sac_id);
    sac_admin.mint(&t.referral_id, &1000_0000000_i128); // 1000 XLM

    // Multiple credits
    t.client.credit(&t.market, &user, &5_000_000_i128); // 0.5 XLM
    t.client.credit(&t.market, &user, &3_000_000_i128); // 0.3 XLM
    t.client.credit(&t.market, &user, &2_000_000_i128); // 0.2 XLM

    assert_eq!(t.client.get_earnings(&referrer), 10_000_000_i128); // 1.0 XLM total
}

// ── 10. Referrer bonus points accumulate (3 per referred bet) ────────────────

#[test]
fn test_referrer_bonus_points_accumulate() {
    let t = setup();
    let user = Address::generate(&t.env);
    let referrer = Address::generate(&t.env);

    t.client.register_referral(
        &user,
        &String::from_str(&t.env, "Bettor"),
        &Some(referrer.clone()),
    );

    // Fund
    let sac_admin = StellarAssetClient::new(&t.env, &t.xlm_sac_id);
    sac_admin.mint(&t.referral_id, &1000_0000000_i128);

    // 3 credits → 3 × 3 = 9 bonus pts for referrer
    t.client.credit(&t.market, &user, &5_000_000_i128);
    t.client.credit(&t.market, &user, &5_000_000_i128);
    t.client.credit(&t.market, &user, &5_000_000_i128);

    let lb_client = leaderboard::LeaderboardContractClient::new(&t.env, &t.leaderboard_id);
    assert_eq!(lb_client.get_points(&referrer), 9); // 3 × 3 pts
}

// ── 11. Referral count tracking ──────────────────────────────────────────────

#[test]
fn test_referral_count_tracking() {
    let t = setup();
    let referrer = Address::generate(&t.env);

    // 3 users register with the same referrer
    for _ in 0..3 {
        let user = Address::generate(&t.env);
        t.client.register_referral(
            &user,
            &String::from_str(&t.env, "Buddy"),
            &Some(referrer.clone()),
        );
    }

    assert_eq!(t.client.get_referral_count(&referrer), 3);
}

// ── 12. Double initialization rejected ───────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_init_rejected() {
    let t = setup();

    // Second init should fail
    let market2 = Address::generate(&t.env);
    t.client.initialize(
        &t.admin,
        &market2,
        &t.token_id,
        &t.leaderboard_id,
        &t.xlm_sac_id,
    );
}

// ── Lever A: lazy migration — a user stored under the OLD key layout must still
//    be fully readable after the upgrade (Registered + DisplayName + Referrer). ──
#[test]
fn test_legacy_user_still_readable() {
    let s = setup();
    let legacy_user = Address::generate(&s.env);
    let legacy_ref = Address::generate(&s.env);

    // Simulate a pre-upgrade registration by writing the OLD keys directly.
    s.env.as_contract(&s.referral_id, || {
        s.env.storage().persistent().set(&DataKey::Registered(legacy_user.clone()), &true);
        s.env.storage().persistent().set(
            &DataKey::DisplayName(legacy_user.clone()),
            &String::from_str(&s.env, "OldTimer"),
        );
        s.env.storage().persistent().set(&DataKey::Referrer(legacy_user.clone()), &legacy_ref);
    });

    // All read paths must resolve via the legacy fallback.
    assert!(s.client.is_registered(&legacy_user));
    assert_eq!(s.client.get_display_name(&legacy_user), String::from_str(&s.env, "OldTimer"));
    assert_eq!(s.client.get_referrer(&legacy_user), Some(legacy_ref.clone()));
    assert!(s.client.has_referrer(&legacy_user));

    // And a legacy user must NOT be able to double-register under the new scheme.
    let res = s.client.try_register_referral(
        &legacy_user,
        &String::from_str(&s.env, "OldTimer"),
        &None,
    );
    assert!(res.is_err());
}

// A legacy user with NO referrer (only Registered + DisplayName) reads correctly.
#[test]
fn test_legacy_user_without_referrer() {
    let s = setup();
    let legacy_user = Address::generate(&s.env);
    s.env.as_contract(&s.referral_id, || {
        s.env.storage().persistent().set(&DataKey::Registered(legacy_user.clone()), &true);
        s.env.storage().persistent().set(
            &DataKey::DisplayName(legacy_user.clone()),
            &String::from_str(&s.env, "Solo"),
        );
    });
    assert!(s.client.is_registered(&legacy_user));
    assert_eq!(s.client.get_referrer(&legacy_user), None);
    assert!(!s.client.has_referrer(&legacy_user));
}

