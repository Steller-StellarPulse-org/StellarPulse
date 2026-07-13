#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Env, String,
};

use PULSE_token::PULSETokenContract;
use leaderboard::LeaderboardContract;
use referral_registry::ReferralRegistryContract;

// ── Test Infrastructure ───────────────────────────────────────────────────────

struct TestSetup {
    env: Env,
    client: PredictionMarketContractClient<'static>,
    admin: Address,
    market_id: Address,
    token_id: Address,
    leaderboard_id: Address,
    referral_id: Address,
    xlm_sac_id: Address,
    xlm_admin: StellarAssetClient<'static>,
    xlm: TokenClient<'static>,
    token_client: PULSE_token::PULSETokenContractClient<'static>,
    leaderboard_client: leaderboard::LeaderboardContractClient<'static>,
    referral_client: referral_registry::ReferralRegistryContractClient<'static>,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();
    env.budget().reset_unlimited();

    env.ledger().set(LedgerInfo {
        timestamp: 1_000_000,
        protocol_version: 26,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 100,
        min_persistent_entry_ttl: 100,
        max_entry_ttl: 10_000_000,
    });

    let admin = Address::generate(&env);

    let xlm_sac_id = env.register_stellar_asset_contract(admin.clone());
    let xlm_admin = StellarAssetClient::new(&env, &xlm_sac_id);
    let xlm = TokenClient::new(&env, &xlm_sac_id);

    let token_id = env.register_contract(None, PULSETokenContract);
    let token_client = PULSE_token::PULSETokenContractClient::new(&env, &token_id);
    token_client.initialize(
        &admin,
        &String::from_str(&env, "PULSE"),
        &String::from_str(&env, "PLSE"),
        &7u32,
    );

    let leaderboard_id = env.register_contract(None, LeaderboardContract);
    let leaderboard_client = leaderboard::LeaderboardContractClient::new(&env, &leaderboard_id);

    let referral_id = env.register_contract(None, ReferralRegistryContract);
    let referral_client = referral_registry::ReferralRegistryContractClient::new(&env, &referral_id);

    let market_id = env.register_contract(None, PredictionMarketContract);
    let client = PredictionMarketContractClient::new(&env, &market_id);

    client.initialize(&admin, &token_id, &referral_id, &leaderboard_id, &xlm_sac_id);
    leaderboard_client.initialize(&admin, &market_id, &referral_id);
    referral_client.initialize(&admin, &market_id, &token_id, &leaderboard_id, &xlm_sac_id);

    // Lever G: the leaderboard now mints PULSE internally (one cross-call from
    // market/referral instead of two). It must know the token AND be authorized
    // as a minter. This mirrors the exact mainnet upgrade sequence.
    leaderboard_client.set_token(&admin, &token_id);
    token_client.set_minter(&leaderboard_id);
    // Legacy minter auths kept harmless (market/referral no longer mint directly).
    token_client.set_minter(&market_id);
    token_client.set_minter(&referral_id);

    TestSetup {
        env,
        client,
        admin,
        market_id,
        token_id,
        leaderboard_id,
        referral_id,
        xlm_sac_id,
        xlm_admin,
        xlm,
        token_client,
        leaderboard_client,
        referral_client,
    }
}

fn fund_user(t: &TestSetup, user: &Address, amount: i128) {
    t.xlm_admin.mint(user, &amount);
}

fn create_test_market(t: &TestSetup) -> u64 {
    t.client.create_market(
        &t.admin,
        &String::from_str(&t.env, "Will BTC hit 100k?"),
        &String::from_str(&t.env, "https://example.com/btc.png"),
        &Category::Crypto,
        &3600_u64,
    )
}

fn advance_time(env: &Env, secs: u64) {
    let current = env.ledger().timestamp();
    env.ledger().set(LedgerInfo {
        timestamp: current + secs,
        protocol_version: 26,
        sequence_number: env.ledger().sequence() + 1,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 100,
        min_persistent_entry_ttl: 100,
        max_entry_ttl: 10_000_000,
    });
}

// ── 1. Initialize ─────────────────────────────────────────────────────────────

#[test]
fn test_initialize() {
    let t = setup();
    assert_eq!(t.client.get_market_count(), 0);
    assert_eq!(t.client.get_accumulated_fees(), 0);
}

// ── 2. Create market ─────────────────────────────────────────────────────────

#[test]
fn test_create_market() {
    let t = setup();
    let id = create_test_market(&t);
    assert_eq!(id, 1);
    assert_eq!(t.client.get_market_count(), 1);

    let market = t.client.get_market(&id);
    assert_eq!(market.total_yes, 0);
    assert_eq!(market.total_no, 0);
    assert!(!market.resolved);
    assert!(!market.cancelled);
    assert_eq!(market.bet_count, 0);
}

// ── 3. Place YES bet ──────────────────────────────────────────────────────────

#[test]
fn test_place_yes_bet() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);

    t.client.place_bet(&user, &id, &true, &100_0000000_i128);

    let market = t.client.get_market(&id);
    assert_eq!(market.total_yes, 98_0000000);
    assert_eq!(market.total_no, 0);
    assert_eq!(market.bet_count, 1);

    let bet = t.client.get_bet(&id, &user);
    assert_eq!(bet.amount, 98_0000000);
    assert!(bet.is_yes);
    assert!(!bet.claimed);

    // Gross tracked correctly
    assert_eq!(t.client.get_bet_gross(&id, &user), 100_0000000);
}

// ── 4. Place NO bet ───────────────────────────────────────────────────────────

#[test]
fn test_place_no_bet() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);

    t.client.place_bet(&user, &id, &false, &100_0000000_i128);

    let market = t.client.get_market(&id);
    assert_eq!(market.total_yes, 0);
    assert_eq!(market.total_no, 98_0000000);
}

// ── 5. Fee: full 2% to AccumulatedFees when no referrer ──────────────────────

#[test]
fn test_fee_full_2_percent_no_referrer() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);

    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    assert_eq!(t.client.get_accumulated_fees(), 2_0000000);
}

// ── 6. Fee split with referrer ────────────────────────────────────────────────

#[test]
fn test_fee_split_with_referrer() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    let referrer = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);

    t.referral_client.register_referral(
        &user,
        &String::from_str(&t.env, "Bettor"),
        &Some(referrer.clone()),
    );

    t.client.place_bet(&user, &id, &true, &100_0000000_i128);

    assert_eq!(t.client.get_accumulated_fees(), 1_5000000);
    assert_eq!(t.xlm.balance(&referrer), 5000000);
    assert_eq!(t.leaderboard_client.get_points(&referrer), 3);
}

// ── 7. Reject bet on expired market ──────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_reject_bet_expired_market() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    advance_time(&t.env, 3601);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
}

// ── 8. Reject bet on resolved market ─────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_reject_bet_resolved_market() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);
    advance_time(&t.env, 3601);
    t.client.resolve_market(&t.admin, &id, &true);

    let user2 = Address::generate(&t.env);
    fund_user(&t, &user2, 200_0000000);
    t.client.place_bet(&user2, &id, &false, &50_0000000_i128);
}

// ── 9. Reject bet on cancelled market ────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_reject_bet_cancelled_market() {
    let t = setup();
    let id = create_test_market(&t);
    t.client.cancel_market(&t.admin, &id);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
}

// ── 10. Reject bet below minimum ─────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_reject_bet_below_minimum() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &5_000_000_i128);
}

// ── 11. Increase existing position ───────────────────────────────────────────

#[test]
fn test_increase_position_same_side() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 500_0000000);

    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    assert_eq!(t.client.get_bet(&id, &user).amount, 98_0000000);

    t.client.place_bet(&user, &id, &true, &50_0000000_i128);
    assert_eq!(t.client.get_bet(&id, &user).amount, 98_0000000 + 49_0000000);

    // Gross tracks full input (both bets)
    assert_eq!(t.client.get_bet_gross(&id, &user), 150_0000000);

    let market = t.client.get_market(&id);
    assert_eq!(market.total_yes, 98_0000000 + 49_0000000);
    assert_eq!(market.bet_count, 1);
}

// ── 12. Reject opposite-side bet ─────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_reject_opposite_side_bet() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 500_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    t.client.place_bet(&user, &id, &false, &50_0000000_i128);
}

// ── 13. Resolve market ───────────────────────────────────────────────────────

#[test]
fn test_resolve_market() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);
    advance_time(&t.env, 3601);
    t.client.resolve_market(&t.admin, &id, &true);
    let market = t.client.get_market(&id);
    assert!(market.resolved);
    assert!(market.outcome);
}

// ── 14. Resolver (non-admin) can resolve ─────────────────────────────────────

#[test]
fn test_resolver_can_resolve() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);

    let resolver = Address::generate(&t.env);
    t.client.add_resolver(&t.admin, &resolver);
    assert!(t.client.is_resolver(&resolver));

    advance_time(&t.env, 3601);
    t.client.resolve_market(&resolver, &id, &true);

    let market = t.client.get_market(&id);
    assert!(market.resolved);
}

// ── 15. Non-resolver cannot resolve ──────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn test_reject_resolve_market_non_resolver() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);
    advance_time(&t.env, 3601);
    let rando = Address::generate(&t.env);
    t.client.resolve_market(&rando, &id, &true);
}

// ── 16. Reject double resolution ─────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_reject_double_resolution() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);
    advance_time(&t.env, 3601);
    t.client.resolve_market(&t.admin, &id, &true);
    t.client.resolve_market(&t.admin, &id, &false);
}

// ── 16b. Reject near-simultaneous resolve by TWO different actors ──────────────
//
// On Soroban, two near-simultaneous resolve transactions are ordered, so the
// second one must observe `market.resolved == true` and be rejected. The
// single-actor case is covered above; this test covers the two-actor race —
// an admin and a separately-authorized resolver both attempt to resolve the
// same market, and whichever lands second must fail with MarketResolved (#7).

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_reject_simultaneous_resolve_two_actors() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);
    advance_time(&t.env, 3601);

    // A second, independently-authorized resolver (the "other actor").
    let resolver = Address::generate(&t.env);
    t.client.add_resolver(&t.admin, &resolver);
    assert!(t.client.is_resolver(&resolver));

    // First resolve (admin) wins the race...
    t.client.resolve_market(&t.admin, &id, &true);
    // ...the resolver's near-simultaneous resolve of the same market must panic.
    t.client.resolve_market(&resolver, &id, &false);
}

// ── 17. Claim-style cancel: admin marks cancelled, bettors pull refunds ───────

#[test]
fn test_cancel_market_claim_style_refund() {
    let t = setup();
    let id = create_test_market(&t);
    let alice = Address::generate(&t.env);
    let bob = Address::generate(&t.env);
    fund_user(&t, &alice, 200_0000000);
    fund_user(&t, &bob, 200_0000000);

    let alice_before = t.xlm.balance(&alice);
    let bob_before = t.xlm.balance(&bob);

    t.client.place_bet(&alice, &id, &true, &100_0000000_i128);
    t.client.place_bet(&bob, &id, &false, &50_0000000_i128);

    // Admin cancels — O(1) gas, no transfers here
    t.client.cancel_market(&t.admin, &id);
    assert!(t.client.get_market(&id).cancelled);

    // Fees should be zeroed from AccumulatedFees since market is cancelled
    // (fees are returned to bettors via cancel_refund)
    let acc_fees_after_cancel = t.client.get_accumulated_fees();
    assert_eq!(acc_fees_after_cancel, 0);

    // Each bettor pulls their own gross refund
    let alice_refund = t.client.cancel_refund(&alice, &id);
    assert_eq!(alice_refund, 100_0000000); // full gross (100 XLM)
    assert_eq!(t.xlm.balance(&alice), alice_before);

    let bob_refund = t.client.cancel_refund(&bob, &id);
    assert_eq!(bob_refund, 50_0000000); // full gross (50 XLM)
    assert_eq!(t.xlm.balance(&bob), bob_before);
}

// ── 18. Cancel refund is idempotent — double refund rejected ──────────────────

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn test_cancel_refund_double_claim_rejected() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    t.client.cancel_market(&t.admin, &id);
    t.client.cancel_refund(&user, &id);
    t.client.cancel_refund(&user, &id); // should fail: NoBetFound (gross zeroed)
}

// ── 19. cancel_refund on non-cancelled market rejected ────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #19)")]
fn test_cancel_refund_non_cancelled_rejected() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    // Market NOT cancelled — should return MarketNotCancelled
    t.client.cancel_refund(&user, &id);
}

// ── 20. Reject cancel on resolved market ─────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_reject_cancel_resolved_market() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);
    advance_time(&t.env, 3601);
    t.client.resolve_market(&t.admin, &id, &true);
    t.client.cancel_market(&t.admin, &id);
}

// ── 21. Claim as winner ───────────────────────────────────────────────────────

#[test]
fn test_claim_winner() {
    let t = setup();
    let id = create_test_market(&t);
    let alice = Address::generate(&t.env);
    let bob = Address::generate(&t.env);
    fund_user(&t, &alice, 200_0000000);
    fund_user(&t, &bob, 200_0000000);

    t.client.place_bet(&alice, &id, &true, &100_0000000_i128);
    t.client.place_bet(&bob, &id, &false, &100_0000000_i128);

    let alice_pre_claim = t.xlm.balance(&alice);
    advance_time(&t.env, 3601);
    t.client.resolve_market(&t.admin, &id, &true);
    t.client.claim(&alice, &id);

    let payout = t.xlm.balance(&alice) - alice_pre_claim;
    assert_eq!(payout, 196_0000000);

    let stats = t.leaderboard_client.get_stats(&alice);
    assert_eq!(stats.won_bets, 1);
    assert_eq!(t.token_client.balance(&alice), 10_0000000);
}

// ── 22. Claim as loser ───────────────────────────────────────────────────────

#[test]
fn test_claim_loser() {
    let t = setup();
    let id = create_test_market(&t);
    let alice = Address::generate(&t.env);
    let bob = Address::generate(&t.env);
    fund_user(&t, &alice, 200_0000000);
    fund_user(&t, &bob, 200_0000000);

    t.client.place_bet(&alice, &id, &true, &100_0000000_i128);
    t.client.place_bet(&bob, &id, &false, &100_0000000_i128);

    let bob_pre_claim = t.xlm.balance(&bob);
    advance_time(&t.env, 3601);
    t.client.resolve_market(&t.admin, &id, &true);
    t.client.claim(&bob, &id);

    assert_eq!(t.xlm.balance(&bob), bob_pre_claim);
    let stats = t.leaderboard_client.get_stats(&bob);
    assert_eq!(stats.lost_bets, 1);
    assert_eq!(t.token_client.balance(&bob), 2_0000000);
}

// ── 23. Reject double claim ───────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_reject_double_claim() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    advance_time(&t.env, 3601);
    t.client.resolve_market(&t.admin, &id, &true);
    t.client.claim(&user, &id);
    t.client.claim(&user, &id);
}

// ── 24. Reject claim on unresolved market ────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_reject_claim_unresolved() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    t.client.claim(&user, &id);
}

// ── 25. Reject claim on cancelled market ─────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_reject_claim_cancelled() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    t.client.cancel_market(&t.admin, &id);
    t.client.claim(&user, &id);
}

// ── 26. Admin withdraw fees ──────────────────────────────────────────────────

#[test]
fn test_withdraw_fees() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);

    let fees_before = t.client.get_accumulated_fees();
    assert!(fees_before > 0);

    let admin_xlm_before = t.xlm.balance(&t.admin);
    let withdrawn = t.client.withdraw_fees(&t.admin, &t.admin);
    assert_eq!(withdrawn, fees_before);
    assert_eq!(t.client.get_accumulated_fees(), 0);
    assert_eq!(t.xlm.balance(&t.admin), admin_xlm_before + fees_before);
}

// ── 27. Fee recipient can withdraw ───────────────────────────────────────────

#[test]
fn test_fee_recipient_withdraw() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);

    let recipient = Address::generate(&t.env);
    let treasury = Address::generate(&t.env);
    t.client.add_fee_recipient(&t.admin, &recipient);

    let fees = t.client.get_accumulated_fees();
    let treasury_before = t.xlm.balance(&treasury);
    t.client.withdraw_fees(&recipient, &treasury);
    assert_eq!(t.xlm.balance(&treasury), treasury_before + fees);
    assert_eq!(t.client.get_accumulated_fees(), 0);
}

// ── 28. Non-authorized cannot withdraw fees ───────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #18)")]
fn test_reject_withdraw_fees_non_admin() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    let rando = Address::generate(&t.env);
    t.client.withdraw_fees(&rando, &rando);
}

// ── 29. Bettor index enumeration ─────────────────────────────────────────────

#[test]
fn test_bettor_index_enumeration() {
    let t = setup();
    let id = create_test_market(&t);
    let alice = Address::generate(&t.env);
    let bob = Address::generate(&t.env);
    let charlie = Address::generate(&t.env);
    fund_user(&t, &alice, 200_0000000);
    fund_user(&t, &bob, 200_0000000);
    fund_user(&t, &charlie, 200_0000000);

    t.client.place_bet(&alice, &id, &true, &10_0000000_i128);
    t.client.place_bet(&bob, &id, &false, &20_0000000_i128);
    t.client.place_bet(&charlie, &id, &true, &30_0000000_i128);

    let bettors = t.client.get_market_bettors(&id);
    assert_eq!(bettors.len(), 3);
    assert_eq!(bettors.get(0).unwrap(), alice);
    assert_eq!(bettors.get(1).unwrap(), bob);
    assert_eq!(bettors.get(2).unwrap(), charlie);
}

// ── 30. Referrer earns 3 bonus points per referred bet ───────────────────────

#[test]
fn test_referrer_bonus_points_per_bet() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    let referrer = Address::generate(&t.env);
    fund_user(&t, &user, 500_0000000);

    t.referral_client.register_referral(
        &user,
        &String::from_str(&t.env, "Fan"),
        &Some(referrer.clone()),
    );

    t.client.place_bet(&user, &id, &true, &100_0000000_i128);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);

    assert_eq!(t.leaderboard_client.get_points(&referrer), 6);
}

// ── 31. Spam guard: TooManyBets ──────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #17)")]
fn test_reject_too_many_bets() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 10_000_0000000);

    for _ in 0..=20u32 {
        t.client.place_bet(&user, &id, &true, &1_0000000_i128);
    }
}

// ── 32. Market creation rate limiting ────────────────────────────────────────

#[test]
fn test_market_creation_rate_limit_allows_up_to_max() {
    let t = setup();
    // Should be able to create up to MAX_MARKETS_PER_HOUR (10) in the same window
    for i in 0..10u32 {
        let _ = t.client.create_market(
            &t.admin,
            &String::from_str(&t.env, "Market"),
            &String::from_str(&t.env, "https://x.png"),
            &Category::Crypto,
            &(3600_u64 + i as u64),
        );
    }
    assert_eq!(t.client.get_market_count(), 10);
}

#[test]
#[should_panic(expected = "Error(Contract, #20)")]
fn test_market_creation_rate_limit_exceeded() {
    let t = setup();
    // Create 10 markets (the limit)
    for i in 0..10u32 {
        let _ = t.client.create_market(
            &t.admin,
            &String::from_str(&t.env, "Market"),
            &String::from_str(&t.env, "https://x.png"),
            &Category::Crypto,
            &(3600_u64 + i as u64),
        );
    }
    // 11th should fail
    t.client.create_market(
        &t.admin,
        &String::from_str(&t.env, "Over limit"),
        &String::from_str(&t.env, "https://x.png"),
        &Category::Sports,
        &7200_u64,
    );
}

#[test]
fn test_market_creation_rate_limit_resets_after_window() {
    let t = setup();
    for i in 0..10u32 {
        let _ = t.client.create_market(
            &t.admin,
            &String::from_str(&t.env, "Market"),
            &String::from_str(&t.env, "https://x.png"),
            &Category::Crypto,
            &(3600_u64 + i as u64),
        );
    }
    // Advance past the 1-hour window
    advance_time(&t.env, 3601);
    // Should be able to create again
    let id = t.client.create_market(
        &t.admin,
        &String::from_str(&t.env, "New window market"),
        &String::from_str(&t.env, "https://x.png"),
        &Category::Sports,
        &7200_u64,
    );
    assert_eq!(id, 11);
}

// ── 33. Double initialization rejected ───────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_init_rejected() {
    let t = setup();
    let tok2 = Address::generate(&t.env);
    let ref2 = Address::generate(&t.env);
    let lb2 = Address::generate(&t.env);
    let xlm2 = Address::generate(&t.env);
    t.client.initialize(&t.admin, &tok2, &ref2, &lb2, &xlm2);
}

// ── 34. Resolve before deadline rejected ─────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_reject_resolve_before_deadline() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);
    t.client.resolve_market(&t.admin, &id, &true);
}

// ── 35. Withdraw fees when zero ───────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn test_withdraw_fees_zero() {
    let t = setup();
    t.client.withdraw_fees(&t.admin, &t.admin);
}

// ── 36. Claim with no bet → NoBetFound ───────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn test_claim_no_bet_found() {
    let t = setup();
    let id = create_test_market(&t);
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 200_0000000);
    t.client.place_bet(&user, &id, &true, &50_0000000_i128);
    advance_time(&t.env, 3601);
    t.client.resolve_market(&t.admin, &id, &true);
    let stranger = Address::generate(&t.env);
    t.client.claim(&stranger, &id);
}

// ── 37. Non-admin create market rejected ─────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_reject_create_market_non_admin() {
    let t = setup();
    let rando = Address::generate(&t.env);
    t.client.create_market(
        &rando,
        &String::from_str(&t.env, "Unauthorized?"),
        &String::from_str(&t.env, "https://x.png"),
        &Category::Other,
        &3600_u64,
    );
}

// ── 38. Non-admin cancel rejected ────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_reject_cancel_market_non_admin() {
    let t = setup();
    let id = create_test_market(&t);
    let rando = Address::generate(&t.env);
    t.client.cancel_market(&rando, &id);
}

// ── 39. Market not found ─────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_market_not_found() {
    let t = setup();
    t.client.get_market(&999);
}

// ── 40. Multiple markets with categories ─────────────────────────────────────

#[test]
fn test_create_multiple_markets() {
    let t = setup();
    let id1 = t.client.create_market(
        &t.admin,
        &String::from_str(&t.env, "Market A"),
        &String::from_str(&t.env, "https://a.png"),
        &Category::Crypto,
        &3600_u64,
    );
    let id2 = t.client.create_market(
        &t.admin,
        &String::from_str(&t.env, "Market B"),
        &String::from_str(&t.env, "https://b.png"),
        &Category::Sports,
        &7200_u64,
    );
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(t.client.get_market_count(), 2);
    assert_eq!(t.client.get_market(&id2).category, Category::Sports);
}

// ── 41. Empty-side resolution: pool goes to AccumulatedFees, admin can withdraw ─

#[test]
fn test_empty_side_resolution_pool_to_fees() {
    let t = setup();
    let id = create_test_market(&t);
    let alice = Address::generate(&t.env);
    fund_user(&t, &alice, 200_0000000);

    // Only YES bets — no one bets NO
    t.client.place_bet(&alice, &id, &true, &100_0000000_i128);
    let fees_before = t.client.get_accumulated_fees();
    assert_eq!(fees_before, 2_0000000); // 2% platform fee

    // Advance past end_time and resolve NO (empty winning side)
    advance_time(&t.env, 3601);
    t.client.resolve_market(&t.admin, &id, &false); // total_no == 0

    // The entire pool (total_yes net = 98 XLM) must be swept into AccumulatedFees
    let fees_after = t.client.get_accumulated_fees();
    assert_eq!(fees_after, fees_before + 98_0000000,
        "entire YES pool should sweep to fees when NO side is empty");

    // Admin can withdraw the swept pool
    let treasury = Address::generate(&t.env);
    let before = t.xlm.balance(&treasury);
    let withdrawn = t.client.withdraw_fees(&t.admin, &treasury);
    assert_eq!(withdrawn, fees_after);
    assert_eq!(t.xlm.balance(&treasury), before + fees_after);
    assert_eq!(t.client.get_accumulated_fees(), 0);

    // Alice (was YES, losing side) can still claim — gets PULSE tokens + points
    t.client.claim(&alice, &id);
    let bet = t.client.get_bet(&id, &alice);
    assert!(bet.claimed);
    // Gets lose-tier rewards because winning_side == 0
    assert_eq!(t.token_client.balance(&alice), 2_0000000); // LOSE_TOKENS
    assert_eq!(t.leaderboard_client.get_points(&alice), 10); // LOSE_POINTS
}

// ── 42. Cancel accumulates fees on multiple bets correctly ────────────────────

#[test]
fn test_cancel_fees_zeroed_correctly() {
    let t = setup();
    let id = create_test_market(&t);
    let alice = Address::generate(&t.env);
    let bob = Address::generate(&t.env);
    fund_user(&t, &alice, 200_0000000);
    fund_user(&t, &bob, 200_0000000);

    // Two bets accumulate fees
    t.client.place_bet(&alice, &id, &true, &100_0000000_i128); // 2 XLM fee
    t.client.place_bet(&bob, &id, &false, &100_0000000_i128); // 2 XLM fee
    assert_eq!(t.client.get_accumulated_fees(), 4_0000000);

    // Cancel zeroes out those fees
    t.client.cancel_market(&t.admin, &id);
    assert_eq!(t.client.get_accumulated_fees(), 0);

    // Bettors get their gross back
    t.client.cancel_refund(&alice, &id);
    t.client.cancel_refund(&bob, &id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 42. COMPREHENSIVE END-TO-END INTEGRATION TEST
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_e2e_full_inter_contract_flow() {
    let t = setup();

    let alice = Address::generate(&t.env);
    let bob = Address::generate(&t.env);
    let referrer = Address::generate(&t.env);
    fund_user(&t, &alice, 1000_0000000);
    fund_user(&t, &bob, 1000_0000000);

    t.referral_client.register_referral(
        &alice,
        &String::from_str(&t.env, "Alice"),
        &Some(referrer.clone()),
    );
    assert_eq!(t.leaderboard_client.get_points(&alice), 5);
    assert_eq!(t.token_client.balance(&alice), 1_0000000);

    let market_id = t.client.create_market(
        &t.admin,
        &String::from_str(&t.env, "Will ETH flip BTC?"),
        &String::from_str(&t.env, "https://eth.png"),
        &Category::Crypto,
        &3600_u64,
    );
    assert_eq!(market_id, 1);

    // Alice bets YES 100 XLM — has referrer
    t.client.place_bet(&alice, &market_id, &true, &100_0000000_i128);
    assert_eq!(t.client.get_accumulated_fees(), 1_5000000);
    assert_eq!(t.xlm.balance(&referrer), 5000000);
    assert_eq!(t.leaderboard_client.get_points(&referrer), 3);
    // total_bets now = won+lost (0 before claim)
    assert_eq!(t.leaderboard_client.get_stats(&alice).total_bets, 0);
    assert_eq!(t.client.get_market(&market_id).total_yes, 98_0000000);
    assert_eq!(t.client.get_bet_gross(&market_id, &alice), 100_0000000);

    // Bob bets NO 200 XLM — no referrer
    t.client.place_bet(&bob, &market_id, &false, &200_0000000_i128);
    assert_eq!(t.client.get_accumulated_fees(), 5_5000000);
    // total_bets now = won+lost (0 before claim)
    assert_eq!(t.leaderboard_client.get_stats(&bob).total_bets, 0);
    assert_eq!(t.client.get_market(&market_id).total_no, 196_0000000);

    // Alice increases YES (+50 XLM)
    t.client.place_bet(&alice, &market_id, &true, &50_0000000_i128);
    let alice_bet = t.client.get_bet(&market_id, &alice);
    assert_eq!(alice_bet.amount, 98_0000000 + 49_0000000);
    assert_eq!(t.client.get_bet_gross(&market_id, &alice), 150_0000000);
    assert_eq!(t.client.get_market(&market_id).total_yes, 147_0000000);
    assert_eq!(t.client.get_market(&market_id).bet_count, 2);
    assert_eq!(t.leaderboard_client.get_points(&referrer), 6);

    // Add a resolver and resolve via them
    let resolver = Address::generate(&t.env);
    t.client.add_resolver(&t.admin, &resolver);
    advance_time(&t.env, 3601);
    t.client.resolve_market(&resolver, &market_id, &true);
    assert!(t.client.get_market(&market_id).resolved);

    // Alice claims as winner
    let alice_xlm_before = t.xlm.balance(&alice);
    t.client.claim(&alice, &market_id);
    let alice_payout = t.xlm.balance(&alice) - alice_xlm_before;
    assert_eq!(alice_payout, 343_0000000);
    assert_eq!(t.leaderboard_client.get_points(&alice), 35);
    assert_eq!(t.token_client.balance(&alice), 11_0000000);

    // Bob claims as loser
    let bob_xlm_before = t.xlm.balance(&bob);
    t.client.claim(&bob, &market_id);
    assert_eq!(t.xlm.balance(&bob), bob_xlm_before);
    assert_eq!(t.leaderboard_client.get_points(&bob), 10);
    assert_eq!(t.token_client.balance(&bob), 2_0000000);

    // Fee withdrawal to a treasury address
    let treasury = Address::generate(&t.env);
    let fees_total = t.client.get_accumulated_fees();
    assert!(fees_total > 0);
    let treasury_before = t.xlm.balance(&treasury);
    let withdrawn = t.client.withdraw_fees(&t.admin, &treasury);
    assert_eq!(withdrawn, fees_total);
    assert_eq!(t.client.get_accumulated_fees(), 0);
    assert_eq!(t.xlm.balance(&treasury), treasury_before + fees_total);

    // Create second market, bet, then cancel — verify claim-style refund
    let market2 = t.client.create_market(
        &t.admin,
        &String::from_str(&t.env, "Will DOGE hit $1?"),
        &String::from_str(&t.env, "https://doge.png"),
        &Category::Crypto,
        &7200_u64,
    );
    let charlie = Address::generate(&t.env);
    fund_user(&t, &charlie, 500_0000000);
    let charlie_before = t.xlm.balance(&charlie);
    t.client.place_bet(&charlie, &market2, &true, &100_0000000_i128);
    t.client.cancel_market(&t.admin, &market2);
    // AccumulatedFees from market2 should be zeroed
    assert_eq!(t.client.get_accumulated_fees(), 0);
    // Charlie pulls their own refund (gross = 100 XLM)
    let refunded = t.client.cancel_refund(&charlie, &market2);
    assert_eq!(refunded, 100_0000000);
    assert_eq!(t.xlm.balance(&charlie), charlie_before);
}


