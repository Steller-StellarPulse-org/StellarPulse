# StellarPulse — Architecture
StellarPulse is a decentralized prediction market built on Stellar's Soroban smart contract platform with a Next.js 14 frontend.
  │  Calls ──►  PULSEToken.mint()                           │    │
  │  Calls ──►  PulseToken.mint()                           │    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐     │
│  │ PulseToken   │  │ Leaderboard  │  │  ReferralRegistry     │     │
│  │  (SAC-like)  │  │              │  │                       │     │
│  │  mint·burn   │  │  add_points  │  │  register_referral    │     │
│  │  transfer    │  │  record_bet  │  │  credit (fee split)   │     │
│  │  balance     │  │  get_top     │  │  get_display_name     │     │
│  │  set_minter  │  │  get_stats   │  │                       │     │
│  └──────────────┘  └──────────────┘  └───────────────────────┘     │

## System Overview

PULSE is a decentralized prediction market built on Stellar's Soroban smart contract platform with a Next.js 14 frontend.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Pages    │  │  Hooks   │  │  Services    │  │  Wallet Kit   │  │
│  │  (7 routes)│ │  (9 hooks)│ │  (7 modules) │  │  (Freighter,  │  │
│  └──────────┘  └──────────┘  └──────┬───────┘  │  xBull,Albedo)│  │
│                                     │           └───────┬───────┘  │
└─────────────────────────────────────┼───────────────────┼──────────┘
                                      │ Soroban RPC       │ Sign TX
                                      ▼                   ▼
┌─────────────────────────── Stellar Testnet ─────────────────────────┐
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │               PredictionMarket Contract                     │    │
│  │  create_market · place_bet · resolve_market · cancel_market │    │
│  │  claim · get_market · get_odds · withdraw_fees              │    │
│  │                                                             │    │
│  │  Calls ──►  PulseToken.mint()                           │    │
│  │  Calls ──►  Leaderboard.add_points() / record_bet()        │    │
│  │  Calls ──►  ReferralRegistry.credit()                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│           │                 │                    │                   │
│           ▼                 ▼                    ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐     │
│  │ PulseToken   │  │ Leaderboard  │  │  ReferralRegistry     │     │
│  │  (SAC-like)  │  │              │  │                       │     │
│  │  mint·burn   │  │  add_points  │  │  register_referral    │     │
│  │  transfer    │  │  record_bet  │  │  credit (fee split)   │     │
│  │  balance     │  │  get_top     │  │  get_display_name     │     │
│  │  set_minter  │  │  get_stats   │  │                       │     │
│  └──────────────┘  └──────────────┘  └───────────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Inter-Contract Call Flow

### User Places a Bet (2% fee)

```
User → PredictionMarket.place_bet(user, market_id, YES, 100 XLM)
  │
  ├─ 1. Validate: market active, side matches existing bet (if any)
  ├─ 2. Transfer 100 XLM from user to contract
  ├─ 3. Deduct 2% fee (2 XLM):
  │     ├─ Check ReferralRegistry.has_referrer(user)
  │     │   ├── YES: 1.5 XLM → AccumulatedFees, 0.5 XLM → referrer
  │     │   │   └─ ReferralRegistry.credit(user, 0.5 XLM, 3 bonus_pts)
  │     │   │        ├─ Send 0.5 XLM to referrer
  │     │   │        ├─ Leaderboard.add_bonus_pts(referrer, 3)
  │     │   │        └─ Emit referral_credited event
  │     │   └── NO:  2 XLM → AccumulatedFees (platform keeps full 2%)
  │     └─ Net bet: 98 XLM added to YES pool
  ├─ 4. Leaderboard.record_bet(user) → increment bet counter
  ├─ 5. Update BettorAt index for the market
  └─ 6. Emit bet_placed event
```

### Admin Resolves Market

```
Admin → PredictionMarket.resolve_market(market_id, YES)
  │
  ├─ 1. Set market.resolved = true, market.outcome = YES
  ├─ 2. Store resolution timestamp
  ├─ 3. No funds move yet (payouts happen at claim time)
  └─ 4. Emit market_resolved event
```

### User Claims Rewards

```
User → PredictionMarket.claim(user, market_id)
  │
  ├─ WINNER (bet matches outcome):
  │   ├─ 1. Calculate payout: (user_bet / winning_pool) × total_pool
  │   ├─ 2. Transfer XLM payout to user
  │   ├─ 3. Leaderboard.add_points(user, 30) — WIN_POINTS
  │   ├─ 4. PULSEToken.mint(user, 10) — WIN_TOKENS
  │   └─ 5. Emit reward_claimed event
  │
  ├─ LOSER (bet doesn't match outcome):
  │   ├─ 1. No XLM payout
  │   ├─ 2. Leaderboard.add_points(user, 10) — LOSE_POINTS
  │   ├─ 3. PULSEToken.mint(user, 2) — LOSE_TOKENS
  │   └─ 4. Emit reward_claimed event
  │
  └─ CANCELLED:
      ├─ 1. Refund net bet amount to user
      └─ 2. Emit reward_claimed event
```

### User Registers for Referral (Optional)

```
User → ReferralRegistry.register_referral(user, "CryptoKing", referrer?)
  │
  ├─ 1. Store display name
  ├─ 2. Link referrer (if provided and valid, no self-referral)
  ├─ 3. Leaderboard.add_bonus_pts(user, 5) — welcome bonus
  ├─ 4. PULSEToken.mint(user, 1) — welcome token
  ├─ 5. If referrer provided:
  │     ├─ Leaderboard.add_bonus_pts(referrer, 5)
  │     └─ PULSEToken.mint(referrer, 1)
  └─ 7. Emit referral_registered event
```

## Data Flow Summary

### Storage Layout

| Contract | Key Storage Items |
|----------|-------------------|
| **PredictionMarket** | `MarketCount`, `Market(id)`, `Bet(market_id, user)`, `BettorCount(market_id)`, `BettorAt(market_id, index)`, `AccumulatedFees` |
| **PulseToken** | `Admin`, `AuthorizedMinter(address) → bool`, `Balance(address)`, `TotalSupply`, `TokenMeta` |
| **Leaderboard** | `Points(address)`, `TotalBets(address)`, `WonBets(address)`, `LostBets(address)`, `TopPlayers (sorted Vec)` |
| **ReferralRegistry** | `DisplayName(address)`, `Referrer(address)`, `ReferralCount(address)`, `Earnings(address)`, linked contract IDs |

### Fee Model

| Source | Platform (AccumulatedFees) | Referrer | Total |
|--------|---------------------------|----------|-------|
| User has referrer | 1.5% (150 BPS) | 0.5% (50 BPS) | 2.0% |
| User has no referrer | 2.0% (200 BPS) | 0% | 2.0% |

### Reward Model

| Outcome | Points | PULSE Tokens | XLM Payout |
|---------|--------|-----------------|------------|
| Win | +30 | +10 | proportional share of pool |
| Lose | +10 | +2 | none |
| Cancel | 0 | 0 | net bet refund |
| Register (referral) | +5 | +1 | — |
| Referrer per bet | +3 | 0 | +0.5% of referred bet |

## Frontend Architecture

```
Next.js 14 (App Router)
├── Server Components (pages, layout)
├── Client Components ('use client')
│   ├── Data hooks (useMarkets, useLeaderboard, etc.)
│   ├── Action hooks (useBet, useClaim)
│   └── Context (WalletProvider via useWallet)
├── Services Layer
│   ├── soroban.ts — RPC client, buildAndSendTx
│   ├── market.ts — PredictionMarket calls
│   ├── token.ts — PulseToken calls
│   ├── leaderboard.ts — Leaderboard calls
│   ├── referral.ts — ReferralRegistry calls
│   ├── events.ts — Soroban event polling
│   └── cache.ts — TTL localStorage cache (ip_ prefix)
└── Wallet Kit (Freighter, xBull, Albedo)
```

### Error Handling Strategy

- **React Error Boundaries** wrap every major section (market grid, betting panel, leaderboard table, claim section)
- **Service-level errors** classified into `AppError` types: `NETWORK`, `WALLET`, `CONTRACT`, `VALIDATION`, `SIMULATION`, `TIMEOUT`
- **Toast notifications** for transaction success/failure feedback
- **Graceful fallbacks** — failed contract calls return `null` / empty arrays instead of crashing

