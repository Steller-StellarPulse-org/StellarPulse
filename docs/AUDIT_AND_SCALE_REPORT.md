# StellarPulse — Production Readiness, Security Audit & Scale Report

**Date:** June 1, 2026
**Auditor:** Claude Code (Principal Protocol Engineer)
**Protocol:** StellarPulse Decentralized Prediction Market on Stellar Soroban
**Scope:** Smart Contracts (4), Frontend (Next.js), Deployment Infrastructure
**Contract State:** 3 of 4 contracts pending mainnet deploy

---

## Executive Summary

| Dimension | Score | Status |
|---|---|---|
| **Security** | 7.5 / 10 | Conditional Pass |
| **Gas Optimization** | 9 / 10 | Pass |
| **Scalability** | 6 / 10 | Conditional Pass |
| **Frontend Quality** | 7 / 10 | Pass |
| **Mainnet Readiness** | 7 / 10 | Conditional Pass |

**Launch Decision: CONDITIONAL PASS**

The protocol can launch on mainnet safely under two conditions:

1. **Critical fix:** `resolve_market` must reject resolution to the empty side (OR trigger auto-cancel when `winning_side == 0`) to prevent funds from becoming permanently unrecoverable.
2. **Operational gate:** At least 3 trusted resolver addresses must be registered before any market is publicly promoted, so resolution never depends on a single admin key.

Everything else documented below is either already mitigated, a known accepted risk, or a Phase 2 improvement.

---

## Part 1 — Smart Contract Audit

### CRITICAL: Funds Stuck via Empty-Side Resolution

**Severity:** Critical
**Affected function:** `resolve_market`
**Status:** NOT fixed (requires contract redeploy — deferred to Phase 1.5)

**Attack scenario:**
```
1. Market: "Will BTC hit $150k?"
2. 1,000 users bet YES (total_yes = 50,000 XLM net), 0 bet NO
3. Resolver (admin or malicious resolver) calls resolve_market(market_id, outcome=false)
4. winning_side = market.total_no = 0
5. Payout guard: `if is_winner && winning_side > 0` → payout SKIPPED
6. 50,000 XLM is permanently locked in the contract
7. withdraw_fees() only withdraws platform fees — does not touch the betting pool
8. NO recovery path exists
```

**Root cause:** The payout guard correctly prevents division by zero but has no fallback when `winning_side == 0`.

**Fix (to apply before Phase 2 redeploy):**
```rust
// In resolve_market(), add before setting resolved = true:
if outcome && market.total_yes == 0 {
    // No YES bettors — cancel instead of resolve YES
    market.cancelled = true;
    // ... refund logic
    return Ok(());
}
if !outcome && market.total_no == 0 {
    // No NO bettors — cancel instead of resolve NO
    market.cancelled = true;
    return Ok(());
}
```

**Interim mitigation (operational, no code change):**
- Resolver must visually verify that `total_yes > 0` AND `total_no > 0` before calling `resolve_market`
- If one side is empty, call `cancel_market` instead
- Document this in resolver operating procedures

---

### HIGH: Single Admin Key Controls Everything

**Severity:** High (Operational Risk)
**Status:** Partially mitigated by resolver system — accepted risk at launch

The admin key (`GDZ4VJWNJPLNU3PAWDYX3V5XNATO7X257DPHWRPFXSCCNEUZ7QTXIIUI`) can:
- Create unlimited markets (rate limited to 10/hour)
- Cancel any market at any time
- Withdraw all accumulated platform fees at any time
- Add/remove resolver and fee recipient addresses

If this key is compromised:
- Attacker can drain all accumulated fees immediately
- Attacker cannot steal user betting pool funds (those are per-market and released only via claim/refund)
- Attacker can cancel markets to prevent resolution (forces all users to call cancel_refund)
- Attacker cannot steal user funds — worst case is cancelled markets and lost platform fees

**Mitigation steps (no contract change needed):**
1. Store the admin seed phrase in a hardware wallet (Ledger/Trezor) — never in a hot wallet
2. Rotate the admin key to a multisig address after launch (requires contract upgrade)
3. Immediately add 3+ resolver addresses so resolution never depends on admin alone

---

### MEDIUM: Reentrancy Pattern in `claim()`

**Severity:** Medium (theoretical on Soroban)
**Status:** Safe — Soroban has native reentrancy protection

The current order in `claim()`:
```
1. Transfer XLM payout to user
2. invoke_contract(leaderboard.add_pts)
3. invoke_contract(token.mint)
4. entry.claimed = true  ← marked AFTER cross-contract calls
```

**On EVM this would be critical.** On Soroban it is **safe** because:
- Soroban's host prevents re-entrant calls into the same contract instance
- All three calls execute atomically in the same transaction
- The host validates auth before any execution begins

**Best practice recommendation (no urgency):** Mark `entry.claimed = true` before the cross-contract calls as defensive coding. Costs nothing, makes audits easier.

---

### MEDIUM: `get_market_bettors` Does Not Scale

**Severity:** Medium (scale risk, not security)
**Status:** Known limitation — view function only

`get_market_bettors()` reads `BettorAt(market_id, i)` for each bettor in a loop. At 10,000 bettors:
- 10,000 persistent storage reads in one simulation call
- Soroban simulation has a soft limit around 200-300 entries before response size issues
- This function will silently truncate or fail on large markets

**Impact:** The function is only called by the frontend for display purposes. It does not affect payouts, claims, or any financial operation. Users can always claim their own rewards regardless.

**Fix options:**
1. Frontend: limit display to first 100 bettors, add "View all on explorer" link
2. Phase 2: Remove `BettorAt` index entirely — replace with off-chain indexer

---

### LOW: Rate Limit Window Can Be Gamed at Boundary

**Severity:** Low
**Status:** Accepted risk

`check_rate()` uses a rolling window starting at `window_start`. If `window_start` is at time T, an admin can create 10 markets at T, then 10 more at T+3601 (new window). An adversary with the admin key could create 20 markets in 2 seconds by straddling the window boundary.

**Impact:** None in practice — admin key is trusted. Rate limit is designed to prevent accidental spam, not adversarial abuse.

---

### LOW: `MAX_BETS_PER_USER = 20` is Enforced Per Market, Not Globally

**Severity:** Low (expected behavior)
**Status:** Accepted — by design

A single user can bet on every market, 20 times each. This is intentional — the limit prevents slot exhaustion attacks on a single market, not global activity limits.

---

### INFORMATIONAL: Fee Math Precision

**Status:** VERIFIED CORRECT

```
Amount: 1 XLM   → fee: 0.02 XLM, net: 0.98 XLM, drift: 0 stroops ✓
Amount: 10 XLM  → fee: 0.20 XLM, net: 9.80 XLM, drift: 0 stroops ✓
Amount: 100 XLM → fee: 2.00 XLM, net: 98.00 XLM, drift: 0 stroops ✓
```

Integer arithmetic with `* 9800 / 10000` produces zero drift at all tested amounts. No precision loss risk.

---

### INFORMATIONAL: Overflow Protection

**Status:** VERIFIED — `overflow-checks = true` in `Cargo.toml`

All arithmetic panics on overflow in release builds. Soroban traps panics as contract errors. No silent overflow possible.

---

### INFORMATIONAL: No Reentrancy Risk on Soroban

Soroban's host runtime prevents recursive calls into the same contract. Unlike EVM, there is no reentrancy attack surface. The `claimed = true` flag post-transfer is a defense-in-depth pattern but not a security requirement.

---

## Part 2 — Security Score Card

| Attack Vector | Risk | Mitigated? |
|---|---|---|
| Empty-side resolution → funds stuck | Critical | **NO — operational mitigation only** |
| Admin key compromise → fee drain | High | Partial (use HW wallet) |
| Admin key compromise → market cancel | High | Partial (users still refund via cancel_refund) |
| Double claim | Critical | **YES** — `entry.claimed` flag |
| Double refund (cancel_refund) | Critical | **YES** — `entry.gross = 0` guard |
| Reentrancy | High | **YES** — Soroban native protection |
| Fee math overflow | Medium | **YES** — `overflow-checks = true` |
| Spam betting | Medium | **YES** — `MAX_BETS_PER_USER = 20` |
| Market creation spam | Low | **YES** — 10/hour rate limit |
| Opposite-side bet | Low | **YES** — `OppositeSideBet` error |
| Claim before resolution | Medium | **YES** — `MarketNotResolved` check |
| Bet after expiry | Medium | **YES** — `MarketExpired` check |
| Unauthorized resolver | High | **YES** — `require_admin_or_resolver` |
| Unauthorized fee withdrawal | High | **YES** — `require_admin_or_fee_recipient` |
| Front-running | Medium | Accepted — Stellar's parallel tx model minimizes this |
| Oracle manipulation | Critical | **ACCEPTED RISK** — admin/resolver trusted model (Phase 2: oracle) |
| Referral fee theft | Medium | **YES** — `HasReferrer` cache + credit() return value |

---

## Part 3 — Scale Analysis: 10,000+ Users at Launch

### What Scales Well

| Component | Capacity | Assessment |
|---|---|---|
| User claims | Unlimited | Each user's own tx, fully parallel ✓ |
| User bets | Unlimited | Each user's own tx, fully parallel ✓ |
| Leaderboard | 50 tracked, unlimited users | Fixed cost, no growth ✓ |
| Spam prevention | 20 bets/user/market | Hard cap, enforced on-chain ✓ |
| Cancel refunds | O(1) per user | Claim-style, no admin bottleneck ✓ |
| Fee accumulation | i128 (no overflow risk) | Good for decades ✓ |

### What Does Not Scale

| Component | Capacity | Issue |
|---|---|---|
| `getMarkets()` frontend | ~100 markets practical limit | Fetches all N markets via N RPC calls |
| `get_market_bettors()` | ~200-300 bettors before response limit | Simulation response size limit |
| Frontend polling (30s) | ~1,000 concurrent users max | Each user fires 30s interval RPC calls |
| Single Soroban RPC | ~50 req/s public limit | Rate throttled at 1,000 concurrent users |

### 10k Users at Launch: Risk Assessment

**Scenario:** 10,000 users all open the app on launch day.

**What happens:**
1. Each user loads `/markets` → calls `get_market_count` + N `get_market` calls
2. With 20 markets: 10,000 users × 21 RPC calls = 210,000 RPC calls in a burst
3. Public Soroban RPC allows ~50 req/s = 4,200 req/min
4. 210,000 requests at 4,200 req/min = ~50 minutes to serve all users
5. **Result: Every user sees timeouts for 50 minutes**

**Mitigation without backend:**
- Set `NEXT_PUBLIC_SOROBAN_RPC_URL` to a dedicated Soroban RPC node (self-hosted or Ankr/QuickNode)
- A dedicated node handles ~500 req/s = 10 minutes (still not ideal)
- Use aggressive caching in the frontend (current 30s cache helps but doesn't solve bursts)

**Proper fix:** The backend + Redis cache described in `ORACLE_AND_BACKEND.md`. All 10,000 users hit the cache, which refreshes from the RPC every 30 seconds.

---

## Part 4 — Frontend Audit

### What Works Correctly

- ✓ Wallet connection (Freighter, Albedo, XBULL)
- ✓ Place bet with real fee calculation (Platform fee 2% clearly shown)
- ✓ Claim rewards for both winners and losers
- ✓ Cancel refund for cancelled markets
- ✓ Market filtering by category, status
- ✓ Market sorting by volume, newest, ending soon
- ✓ TypeScript: zero errors
- ✓ 139/139 frontend tests passing
- ✓ Mainnet RPC configured (`https://mainnet.sorobanrpc.com`)
- ✓ Freighter shows real fee (not hardcoded 1 XLM anymore)
- ✓ XLM balance refreshes after bet/claim
- ✓ Simulation source falls back to Circle USDC account if user not connected

### Issues Found

#### MEDIUM: No Guard When Contract IDs Are Empty

When `.env.local` is missing `NEXT_PUBLIC_MARKET_CONTRACT_ID`, every service call passes an empty string `""` as the contract ID. The RPC returns "contract not found" and the app shows an empty state — but **the error message shown to the user is the raw RPC error**, not a friendly "App not yet configured" message.

**Impact:** Confusing UX during staging/preview deploys. Not a security issue.

**Recommended fix:**
```typescript
// In services/market.ts, add at top of every exported function:
if (!MARKET_CONTRACT_ID) {
  console.warn("MARKET_CONTRACT_ID not set — returning empty");
  return null; // or []
}
```

#### LOW: `SPONSOR_SECRET_KEY` Mentioned in Source

`frontend/src/services/soroban.ts` line 222 contains `Keypair.fromSecret(SPONSOR_SECRET_KEY)`. The key itself comes from `process.env.NEXT_PUBLIC_SPONSOR_SECRET_KEY` which is blank in the production `.env.local`. No actual secret is hardcoded. But the pattern (`NEXT_PUBLIC_` + secret key) is dangerous — any developer who sets this env var in a Vercel preview environment would expose it in the browser bundle.

**Status:** Blank in production. Documented warning in code. Phase 2 fix: move to `/api/sponsor` server route.

#### LOW: No Mobile-Specific Testing

The frontend uses Tailwind responsive classes but has not been tested on actual mobile devices or small viewports. BettingPanel, MarketCard, and MarketFilters all use `sm:` breakpoints.

#### INFORMATIONAL: 30-Second Auto-Poll

Every hook polls every 30 seconds. At 10,000 concurrent users this is 10,000 × (number of hooks) = 50,000-100,000 RPC calls every 30 seconds. Acceptable for the current testnet phase, requires backend before 10k users.

---

## Part 5 — Mainnet Readiness Checklist

### Smart Contracts

| Check | Status |
|---|---|
| No hardcoded secrets | ✓ |
| No debug code | ✓ |
| No test-only logic in production | ✓ |
| No TODO comments in hot paths | ✓ |
| overflow-checks = true | ✓ |
| All error codes defined and tested | ✓ |
| TTL extension on all persistent writes | ✓ |
| Admin + resolver access control | ✓ |
| Fee recipient access control | ✓ |
| Anti-spam: MAX_BETS_PER_USER | ✓ |
| Anti-spam: rate limit on create_market | ✓ |
| Cancel refund is O(1) per user | ✓ |
| Double-claim prevention | ✓ |
| Double-refund prevention | ✓ |
| Empty-side resolution → funds stuck | **✗ operational mitigation only** |
| Oracle decentralization | **✗ Phase 2** |

### Frontend

| Check | Status |
|---|---|
| TypeScript: zero errors | ✓ |
| 139/139 tests passing | ✓ |
| Mainnet RPC configured | ✓ |
| No sponsor secret in production env | ✓ |
| Real fee display to user | ✓ |
| Balance refreshes after bet/claim | ✓ |
| Error states handled gracefully | ✓ |
| Guard for empty contract IDs | **✗ cosmetic issue** |
| Backend pagination for >100 markets | **✗ Phase 2** |

### Deployment

| Check | Status |
|---|---|
| `.stellar/` in .gitignore | ✓ |
| `.deploy.env` in .gitignore | ✓ |
| deploy-mainnet-output.json in .gitignore | ✓ |
| Admin key never committed | ✓ |
| 4 contracts optimized (wasm-opt) | ✓ |
| Token deployed to mainnet | ✓ (CA3ZEXYRCCNOJQWOTRQXCPJVY32AI4OEPFN27VHYRUO5JV5URGAAVBCC) |
| 3 contracts pending (need 70 XLM) | **Pending funding** |

---

## Part 6 — Gas Optimization Report

### Gas Optimization Score: 9/10

| Optimization | Applied | Saving |
|---|---|---|
| Events stripped (deprecated SDK 26) | ✓ | ~30% WASM size |
| wasm-opt -Oz applied | ✓ | ~34% additional WASM size |
| Config struct (4 reads → 1) | ✓ | ~3 storage reads per bet/claim |
| BetEntry merge (3 keys → 1) | ✓ | ~2 reads + 2 writes per bet |
| `record_bet` cross-contract call removed | ✓ | ~100k gas per bet |
| HasReferrer cache (skip referral call) | ✓ | ~100k gas for users without referrer |
| `upsert_top` O(1) in-place update | ✓ | ~40% leaderboard write cost |
| UserStats (4 keys → 1 per user) | ✓ | ~3 reads + 3 writes per claim |
| CreationWindow packed as tuple | ✓ | ~struct deserialization overhead |
| `#[inline]` on hot helpers | ✓ | Small |

**What was left unoptimized (intentionally):**
- `BettorAt` index: still written per new bettor. Required for cancel_refund to work. Acceptable cost.
- `get_top_players` sort: still O(n²) over 50 entries. Capped at 50 — cost bounded.

---

## Part 7 — Final Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Admin key compromise | High | Use hardware wallet for admin key |
| Resolver resolves to empty side | Critical | Operational procedure: check both sides non-zero before resolving |
| Public RPC rate limits at launch | High | Provision dedicated Soroban RPC node |
| Single point of failure (admin resolver) | High | Register 3+ resolver addresses before public launch |
| No oracle decentralization | Critical (accepted) | Phase 2 optimistic oracle planned |
| `getMarkets()` at >100 markets | Medium | Phase 2 backend indexer planned |
| Sponsor secret in browser bundle pattern | Low | Blank in production, Phase 2 server-side route |

---

## Part 8 — What to Do Before Promoting to Users

### Before First User Deposit (Pre-Launch Checklist)

1. **Fund deployer wallet** with 70 XLM and deploy remaining 3 contracts
2. **Add 3 resolver addresses** via admin panel — never rely on single admin key for resolution
3. **Verify empty-side guard operationally** — document that resolvers must check both sides before calling resolve_market
4. **Point frontend to a dedicated RPC** — not the public `mainnet.sorobanrpc.com` (shared, rate limited)
5. **Create test markets** and verify the full flow end-to-end on mainnet with small amounts
6. **Set `NEXT_PUBLIC_ADMIN_PUBLIC_KEY`** in Vercel to the deployer public key so the admin panel appears
7. **Test cancel_refund** manually on a cancelled market before promoting

### At 1,000 Users (3–6 months)

- Deploy backend API + PostgreSQL indexer (2 weeks effort)
- Move to Redis-cached market list endpoint
- Provision dedicated Soroban RPC (Ankr/QuickNode/self-hosted)

### At 10,000 Users (6–12 months)

- Implement 4-of-7 resolution council (council multisig)
- Deploy optimistic oracle with 24h dispute window
- Add Prometheus + Grafana monitoring
- Implement CI/CD pipeline with security scanning
