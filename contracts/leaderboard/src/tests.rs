#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env};

fn setup() -> (Env, LeaderboardContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.budget().reset_unlimited();

    let contract_id = env.register_contract(None, LeaderboardContract);
    let client = LeaderboardContractClient::new(&env, &contract_id);

    let admin   = Address::generate(&env);
    let market  = Address::generate(&env);
    let referral = Address::generate(&env);

    client.initialize(&admin, &market, &referral);
    (env, client, admin, market, referral)
}

#[test]
fn test_add_points_and_verify_balance() {
    let (env, client, _admin, market, _referral) = setup();
    let user = Address::generate(&env);
    client.add_pts(&market, &user, &100_u64, &true);
    assert_eq!(client.get_points(&user), 100);
}

#[test]
fn test_accumulate_points() {
    let (env, client, _admin, market, _referral) = setup();
    let user = Address::generate(&env);
    client.add_pts(&market, &user, &50_u64, &true);
    client.add_pts(&market, &user, &30_u64, &false);
    client.add_pts(&market, &user, &20_u64, &true);
    assert_eq!(client.get_points(&user), 100);
}

#[test]
fn test_bonus_pts_no_won_lost() {
    let (env, client, _admin, market, referral) = setup();
    let user = Address::generate(&env);
    client.add_pts(&market, &user, &10_u64, &true);
    client.add_pts(&market, &user, &5_u64, &false);

    let before = client.get_stats(&user);
    assert_eq!(before.won_bets, 1);
    assert_eq!(before.lost_bets, 1);

    client.add_bonus_pts(&referral, &user, &25_u64);

    let after = client.get_stats(&user);
    assert_eq!(after.points, 40);
    assert_eq!(after.won_bets, 1);
    assert_eq!(after.lost_bets, 1);
}

#[test]
fn test_top_players_sorted() {
    let (env, client, _admin, market, _referral) = setup();

    let alice   = Address::generate(&env);
    let bob     = Address::generate(&env);
    let charlie = Address::generate(&env);

    client.add_pts(&market, &alice, &50_u64, &true);
    client.add_pts(&market, &bob, &100_u64, &true);
    client.add_pts(&market, &charlie, &75_u64, &true);

    let top = client.get_top_players(&0_u32, &20_u32);
    assert_eq!(top.len(), 3);
    assert_eq!(top.get(0).unwrap().address, bob);
    assert_eq!(top.get(0).unwrap().points, 100);
    assert_eq!(top.get(1).unwrap().address, charlie);
    assert_eq!(top.get(1).unwrap().points, 75);
    assert_eq!(top.get(2).unwrap().address, alice);
    assert_eq!(top.get(2).unwrap().points, 50);
}

#[test]
fn test_top_players_capped_at_50() {
    let (env, client, _admin, market, _referral) = setup();

    for i in 1u64..=55 {
        let user = Address::generate(&env);
        client.add_pts(&market, &user, &i, &true);
    }

    let page1 = client.get_top_players(&0_u32, &20_u32);
    assert_eq!(page1.len(), 20);
    assert_eq!(page1.get(0).unwrap().points, 55);

    let page2 = client.get_top_players(&20_u32, &20_u32);
    assert_eq!(page2.len(), 20);

    let page3 = client.get_top_players(&40_u32, &20_u32);
    assert_eq!(page3.len(), 10);
    assert_eq!(page3.get(9).unwrap().points, 6);

    assert_eq!(client.get_player_count(), 50);
}

#[test]
fn test_pagination_offset_beyond_count() {
    let (env, client, _admin, market, _referral) = setup();
    let user = Address::generate(&env);
    client.add_pts(&market, &user, &100_u64, &true);
    let result = client.get_top_players(&10_u32, &20_u32);
    assert_eq!(result.len(), 0);
}

// OPT: record_bet is now a no-op — total_bets = won_bets + lost_bets
#[test]
fn test_record_bet_is_noop() {
    let (env, client, _admin, market, _referral) = setup();
    let user = Address::generate(&env);
    // record_bet is a no-op — should not change any stats
    client.record_bet(&market, &user);
    client.record_bet(&market, &user);
    let stats = client.get_stats(&user);
    assert_eq!(stats.total_bets, 0); // no wins/losses yet
}

// OPT: total_bets now = won_bets + lost_bets (derived at read time)
#[test]
fn test_get_stats_aggregate() {
    let (env, client, _admin, market, referral) = setup();
    let user = Address::generate(&env);

    // 2 wins, 1 loss = 3 total settled bets
    client.add_pts(&market, &user, &20_u64, &true);
    client.add_pts(&market, &user, &30_u64, &true);
    client.add_pts(&market, &user, &5_u64, &false);

    // Bonus points don't affect won/lost counts
    client.add_bonus_pts(&referral, &user, &10_u64);

    let stats = client.get_stats(&user);
    assert_eq!(stats.points, 65);
    assert_eq!(stats.total_bets, 3); // won_bets(2) + lost_bets(1)
    assert_eq!(stats.won_bets, 2);
    assert_eq!(stats.lost_bets, 1);
}

#[test]
fn test_rank_calculation() {
    let (env, client, _admin, market, _referral) = setup();

    let alice   = Address::generate(&env);
    let bob     = Address::generate(&env);
    let charlie = Address::generate(&env);
    let dave    = Address::generate(&env);

    client.add_pts(&market, &alice, &50_u64, &true);
    client.add_pts(&market, &bob, &100_u64, &true);
    client.add_pts(&market, &charlie, &75_u64, &true);

    assert_eq!(client.get_rank(&bob), 1);
    assert_eq!(client.get_rank(&charlie), 2);
    assert_eq!(client.get_rank(&alice), 3);
    assert_eq!(client.get_rank(&dave), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_unauthorized_caller_rejected() {
    let (env, client, _admin, _market, _referral) = setup();
    let rando = Address::generate(&env);
    let user  = Address::generate(&env);
    client.add_pts(&rando, &user, &10_u64, &true);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_init_rejected() {
    let (_env, client, admin, market, referral) = setup();
    client.initialize(&admin, &market, &referral);
}

#[test]
fn test_player_count() {
    let (env, client, _admin, market, _referral) = setup();
    assert_eq!(client.get_player_count(), 0);

    let u1 = Address::generate(&env);
    let u2 = Address::generate(&env);
    client.add_pts(&market, &u1, &10_u64, &true);
    assert_eq!(client.get_player_count(), 1);
    client.add_pts(&market, &u2, &20_u64, &true);
    assert_eq!(client.get_player_count(), 2);
    client.add_pts(&market, &u1, &5_u64, &false);
    assert_eq!(client.get_player_count(), 2);
}

// ── Lever E: O(1) eviction correctness ────────────────────────────────────────

#[test]
fn test_eviction_replaces_lowest_when_full() {
    // Fill exactly 50 with points 100..149, then add a higher scorer.
    // The new entry must enter and the lowest (100) must be evicted.
    let (env, client, _admin, market, _referral) = setup();
    for i in 0u64..50 {
        let user = Address::generate(&env);
        client.add_pts(&market, &user, &(100 + i), &true);
    }
    assert_eq!(client.get_player_count(), 50);

    let newcomer = Address::generate(&env);
    client.add_pts(&market, &newcomer, &500_u64, &true);

    // Still capped at 50; newcomer is now #1; the old min (100) is gone.
    assert_eq!(client.get_player_count(), 50);
    let top = client.get_top_players(&0_u32, &20_u32);
    assert_eq!(top.get(0).unwrap().points, 500);

    // Lowest entry is now 101 (the original 100 was evicted).
    let last = client.get_top_players(&40_u32, &20_u32);
    assert_eq!(last.get(9).unwrap().points, 101);
}

#[test]
fn test_low_scorer_rejected_when_full() {
    // Fill 50 with high points, then a low scorer must NOT enter the list.
    let (env, client, _admin, market, _referral) = setup();
    for i in 0u64..50 {
        let user = Address::generate(&env);
        client.add_pts(&market, &user, &(1000 + i), &true);
    }
    let weak = Address::generate(&env);
    client.add_pts(&market, &weak, &5_u64, &false);

    // Weak user has stats/points recorded, but is NOT in the top list (rank 0).
    assert_eq!(client.get_points(&weak), 5);
    assert_eq!(client.get_rank(&weak), 0);
    assert_eq!(client.get_player_count(), 50);
}

#[test]
fn test_bottom_player_rising_updates_min() {
    // When the weakest in-list player gains points, the cached min must update
    // so a later newcomer is compared against the NEW (higher) minimum.
    let (env, client, _admin, market, _referral) = setup();
    let weakest = Address::generate(&env);
    // First entry is the weakest at 100; the rest are 110, 120, … (all higher).
    client.add_pts(&market, &weakest, &100_u64, &true);
    for i in 1u64..50 {
        let user = Address::generate(&env);
        client.add_pts(&market, &user, &(100 + i * 10), &true);
    }
    assert_eq!(client.get_player_count(), 50);

    // Boost the weakest (100 -> 1000) so it is no longer the min.
    client.add_pts(&market, &weakest, &900_u64, &true);
    assert_eq!(client.get_points(&weakest), 1000);

    // The true new minimum is now 110 (second-lowest original). A newcomer with
    // 105 should be REJECTED (105 <= 110), proving the min recomputed correctly
    // rather than staying stale at 100.
    let newcomer = Address::generate(&env);
    client.add_pts(&market, &newcomer, &105_u64, &true);
    assert_eq!(client.get_rank(&newcomer), 0);
    assert_eq!(client.get_player_count(), 50);
}

// ── Lever G: reward() / reward_bonus() ────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_reward_rejects_non_market_caller() {
    // Only the market contract may call reward(). A random caller must be
    // rejected with UnauthorizedCaller (#3) — protects token minting.
    let (env, client, _admin, _market, _referral) = setup();
    let rando = Address::generate(&env);
    let user = Address::generate(&env);
    // tokens=0 so we don't need a token wired; the auth guard must fire first.
    client.reward(&rando, &user, &30_u64, &0_i128, &true);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_reward_bonus_rejects_non_referral_caller() {
    let (env, client, _admin, _market, _referral) = setup();
    let rando = Address::generate(&env);
    let user = Address::generate(&env);
    client.reward_bonus(&rando, &user, &5_u64, &0_i128);
}

#[test]
fn test_reward_updates_points_and_winloss() {
    // reward() with tokens=0 (no token wired) still updates points + win/loss
    // exactly like add_pts. Proves the points half is independent of minting.
    let (env, client, _admin, market, _referral) = setup();
    let user = Address::generate(&env);
    client.reward(&market, &user, &30_u64, &0_i128, &true);
    client.reward(&market, &user, &10_u64, &0_i128, &false);
    let s = client.get_stats(&user);
    assert_eq!(s.points, 40);
    assert_eq!(s.won_bets, 1);
    assert_eq!(s.lost_bets, 1);
    assert_eq!(s.total_bets, 2);
}
