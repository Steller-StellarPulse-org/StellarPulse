# Gas Reduction — Contract Upgrade

**Status:** ✅ Levers E + A + G IMPLEMENTED, 89 tests pass, full upgrade cycle
verified on testnet (pre-upgrade bet claimed correctly through new path) · H dropped

> **Honest fee finding (measured on testnet):** the contract-side saving is only
> **~4%** (register 0.1532 → 0.1475 XLM), NOT the ~40% originally projected. The
> total fee a user pays is dominated by the **inclusion fee** (network base fee
> set client-side), not the resource fee these levers reduce. E/A/G are still
> worth shipping — correct architecture + Lever E keeps claim fees FLAT past 50
> players — but the real user-facing fee lever is **frontend inclusion-fee
> tuning**, tracked separately.
**Type:** In-place `upgrade()` of existing mainnet contracts (no redeploy, no new addresses)

## Implementation status (what actually shipped in code)

| Lever | Decision | Why |
|-------|----------|-----|
| **E** — O(1) leaderboard eviction | ✅ **Implemented** | Pure internal algorithm; cached min slot/points in instance storage. Keeps claim fees FLAT past 50 players. +3 edge tests. No ABI/auth/payout change. |
| **A** — pack referral registrant storage | ✅ **Implemented** | New `Profile` key + **lazy-migration fallback reads** of the old keys. Cuts first registration from 3 new entries → 1. +2 migration tests. ABI unchanged → frontend untouched. |
| **H** — pack slot into `UserStats` | ❌ **Dropped** | Would change `UserStats` layout → existing entries panic on parse. Risk ≫ its small saving. |
| **G** — merge reward cross-calls | ⏸️ **Deferred** | Only lever touching the auth/money path (re-threads `require_auth`, swaps token minter). Saved for its own isolated, heavily-tested upgrade so a bug can never block winners from claiming. |

**Tested:** full contract workspace = 86 tests pass (token 11, leaderboard 15,
market 45, referral 15). Optimized WASM rebuilt (leaderboard 9.7KB, referral 7.5KB).
Upgrade script: `scripts/upgrade-gas-reduction.sh <testnet|mainnet>`.

**Guarantee for the resolve→claim path:** the payout formula
`payout = entry.net * total_pool / winning_side` and the `claimed`-flag
re-entrancy guard are **byte-for-byte unchanged**. No user can claim more than
their pro-rata share. E and A only change how the leaderboard indexes its top-50
and how the referral registry packs its keys.

---

### (original design notes below)

**Type:** In-place `upgrade()` of existing mainnet contracts (no redeploy, no new addresses)
**Goal:** Lower the *first-time* fees users pay (first bet on a market ≈ 0.3 XLM,
username registration ≈ 0.31 XLM) **without** reducing storage TTL — because some
markets run **12+ months** before users can claim, and an expired entry would
force a costly restore right when a winner tries to collect.

---

## 1. Why the first-time fee is high (root cause)

Soroban charges a **resource fee** per transaction that is dominated by two things:

1. **New persistent storage entries** — each *new* ledger entry created is charged
   create + rent for its full TTL window upfront.
2. **Cross-contract calls** (`invoke_contract`) — each call into another contract
   (token mint, leaderboard add_pts, referral credit) adds CPU + a footprint
   entry, both metered.

A user's **first** bet or registration is expensive because it *creates several
new entries at once* and *makes several cross-contract calls*. Every later action
on the same key is cheap (it's an in-place update, no new entry).

### Measured cost concentration (verified against the deployed source)

There are **three** expensive first-time paths, not two. The doc originally
focused on `place_bet` and `register_referral`; a full read of all four
contracts shows **`claim` is the most important** because every winner claims,
and it cascades writes across THREE contracts.

**`place_bet` (first bet on a market) creates these NEW persistent entries:**

| Entry | Purpose | Removable? |
|-------|---------|------------|
| `Bet(market_id, user)` | the user's actual bet (net/gross/count) | ❌ load-bearing |
| `HasReferrer(user)` | cache so later bets skip the referral cross-call | ⚠️ optimization, costs a write |
| `BettorAt(market_id, n)` | bettor-index slot (enumeration) | ❌ used by leaderboard + referral discovery |
| `BettorCount(market_id)` | bettor-index length | ❌ used by leaderboard |

…plus a cross-contract `credit` call into the referral registry (which itself may
transfer XLM, mint tokens, and add points).

**`register_referral` creates FOUR new persistent entries in one call:**
`Registered(user)`, `DisplayName(user)`, `Referrer(user)`, `ReferralCount(referrer)`
— **plus two cross-contract calls** (`add_bonus_pts` to leaderboard, `mint` to token).
Four new entries + two cross-calls in a single tx is why first-time registration
is ~0.31 XLM.

**`claim` (the most frequent expensive path) cascades across 3 contracts.**
A FIRST-EVER claim by a user touches, in one transaction:

| Contract | Write / call | New entry? |
|----------|--------------|-----------|
| market | `Bet` update (claimed flag) + TTL bump | no |
| market → leaderboard | `invoke_contract add_pts` (cross-call #1) | — |
| leaderboard | `Stats(user)` write + TTL bump | **yes (first claim)** |
| leaderboard → `upsert_top` | `TopPlayerAt(slot)` write + TTL bump | maybe |
| leaderboard → `upsert_top` | `TopPlayerSlot(user)` write + TTL bump | **yes (first time in top list)** |
| market → token | `invoke_contract mint` (cross-call #2) | — |
| token | `Balance(user)` write | **yes (first ever PLSE)** |

So a first claim = **2 cross-calls + up to 4 new persistent entries spread over
3 contracts.** That is the single biggest fee a normal happy-path user ever pays,
and the original doc under-weighted it.

---

## 2. What we will NOT do (and why)

❌ **Do NOT lower `TTL_HIGH` / `TTL_BUMP`.**
Current: `TTL_HIGH = 6,307,200` ledgers ≈ **1 year**.
Some markets are designed to run **12+ months** before resolution/claim. If a
bet entry's TTL expired before the user claimed, the entry would be archived and
the user (or we) would have to **pay to restore it** before claiming — the single
worst possible "scared by fees" moment. The TTL must always exceed
`market_duration + claim_window`. Shortening it to save rent is a false economy
here. **Keep TTL at ≥ 1 year; if anything, make it derive from market duration
so long markets get a longer TTL, not a shorter one.**

---

## 3. What we WILL do — reduce entry count & cross-calls

The safe levers are **fewer new entries** and **fewer cross-contract calls**,
which cut resource fees without any storage-lifetime risk.

### Lever A — Pack `register_referral` storage into one entry (biggest single win)

Today registration writes 4 separate persistent keys. Pack them into **one
struct** under a single key:

```rust
#[contracttype]
pub struct UserProfile {
    pub registered:   bool,
    pub display_name: String,
    pub referrer:     Option<Address>,
}
```

- Writes **1 new entry** instead of 3 (the user's own profile). `ReferralCount`
  for the *referrer* is a separate user's entry and stays separate, but it's an
  **update** of an existing entry in the common case, not a new create.
- Read paths (`get_referrer`, `get_display_name`, `is_registered`) read one entry
  instead of three — also cheaper for the app.
- **Est. saving on first registration: ~40–50%** (≈0.31 → ~0.16–0.18 XLM).

### Lever B — Defer / batch the cross-contract reward calls

Both `register_referral` and `place_bet`→`credit` make **two cross-contract calls**
(`mint` token + `add_*_pts` leaderboard) inline. Each call is metered CPU + an
extra footprint entry.

Options (in order of preference):

1. **Combine the two reward calls behind ONE call.** Add a single
   `reward(user, points, tokens, is_win)` entry point on a rewards facade (or on
   the leaderboard) that internally credits points and mints tokens, so the market
   makes **1** cross-call instead of 2. Halves the cross-call overhead on the hot
   path.
2. **Make reward minting claim-style / lazy.** Instead of minting PLSE tokens at
   bet/claim time (a cross-call every time), accrue an off-chain or on-chain
   "claimable rewards" counter and let the user mint in one batch later. Removes
   the `mint` cross-call from the hot path entirely. (Bigger change — schedule
   separately.)

### Lever C — Make `HasReferrer` cache opt-in, not eager

The `HasReferrer(user)` entry is written on the first bet purely to *save a
cross-call on later bets*. For a user who only ever bets once, it's pure cost.
Consider writing it **only after the user's second bet** (i.e. when the
optimization actually pays off), or folding the flag into the `Bet`/`UserProfile`
struct so it costs no separate entry.

### Lever D — Confirm the bettor index is still required

`BettorAt` / `BettorCount` are currently used by the leaderboard ("most active")
and referral discovery (`getMarketBettors` fan-out in the frontend). **Do not
remove them** unless those features are first migrated to an event-based indexer.
If we later move leaderboard/referral discovery to reading **contract events**
(emitted on bet, indexed off-chain), we could drop both index entries and cut
another new-entry write from every first bet — but that's a frontend + indexer
change to land first.

### Lever E — O(1) eviction in the leaderboard (scales-with-growth fix) ⭐

**This is the most important new finding.** Once the top-players list is full
(`MAX_TOP_PLAYERS = 50`), every `upsert_top` for a user NOT already in the list
runs a loop reading **all 50 `TopPlayerAt` entries** to find the lowest scorer to
evict. That 50-entry scan happens **inside the `add_pts` cross-call inside every
claim** by a non-top-50 user.

- Today (few users): cheap, list isn't full.
- At scale (50+ active players): **every claim by a mid-tier user pays for a
  50-storage-read scan** — a cost that silently grows with your success.

**Fix:** maintain `min_points` + `min_slot` in **instance storage** (cheap to
co-read), updated incrementally. Eviction becomes O(1): compare against the
cached min, write only if higher. Removes the 50-read loop from the hot path.
This is a *future-proofing* win — it doesn't lower today's fee much, but it
prevents claim fees from creeping up exactly as you grow past ~50 players.

### Lever F — Skip redundant `upsert_top` rewrites

`upsert_top` rewrites `TopPlayerAt(slot)` + bumps TTL on **every** claim, even
when the user is already in the list and their relative position is unchanged.
Points only ever increase, so the write is often cosmetic. Skipping the rewrite
when it doesn't change the user's standing trims a write off many claims. Minor
vs Lever E; bundle it with E since they touch the same code.

### Lever G — Merge the two reward cross-calls into ONE ⭐

Both `claim` and `register_referral` make **two** separate cross-contract calls:
`add_pts`/`add_bonus_pts` (leaderboard) **and** `mint` (token). Each
`invoke_contract` is metered CPU + an extra footprint entry.

**Fix:** add a single `reward(user, points, tokens, is_win)` entry point on the
**leaderboard** (the natural rewards hub) that updates points AND calls the token
`mint` internally. The market then makes **1 cross-call instead of 2** per claim.
Saves a full cross-contract invocation on the most frequent expensive path.

⚠️ **Security checkpoint (Lever G):** this moves the `mint` caller from the
market to the leaderboard. Required, in order:
  1. Authorize the **leaderboard** as a token minter (`set_minter`).
  2. De-authorize the market as a minter once migrated (least privilege).
  3. Ensure `reward()` still enforces `require_market_contract` (only the market
     may grant rewards) so the leaderboard can't be tricked into minting.
  4. Keep the market's `claimed = true` write BEFORE the (now single) cross-call
     — the re-entrancy guard must not move.

### Lever H — Pack `TopPlayerSlot` into `UserStats`

The leaderboard stores `Stats(user)` and `TopPlayerSlot(user)` as two separate
persistent keys per user. Fold the slot into the `UserStats` struct so a
first-time scorer writes **1 new entry instead of 2**. Pairs naturally with
Lever E (both touch the leaderboard's per-user storage).

---

## 4. Expected outcome

| Action | Now | After upgrade | Levers |
|--------|-----|---------------|--------|
| First bet on a market | ~0.30 XLM | ~0.15–0.20 XLM | C, (D later) |
| Username registration | ~0.31 XLM | ~0.14–0.18 XLM | A, G |
| **First claim (winner)** | ~0.30–0.40 XLM | **~0.18–0.24 XLM** | E, G, H |
| Claim at scale (50+ players) | rising with growth | **flat** | **E** |
| Subsequent bets (increase) | ~0.0003 XLM | ~0.0003 XLM (unchanged) | — |

All while **keeping TTL ≥ 1 year** so no entry ever expires before a 12-month
market can be claimed.

**Priority ranking for one combined upgrade:**
1. **Lever E** (O(1) eviction) — prevents claim fees rising as you scale. Highest long-term value.
2. **Lever G** (merge reward cross-calls) — saves a cross-call on every claim AND every register.
3. **Lever A** (pack register storage) — biggest single register win.
4. **Lever H** (pack slot into stats) — small, pairs with E.
5. **Levers C / F** — minor trims, bundle if cheap.

All of E, G, A, H touch only storage layout and the call graph — **the fee math,
payout logic, points/tokens, and claim-style re-entrancy guard are unchanged.**

---

## 5. Rollout (safe, in-place)

1. Implement the chosen levers (recommended: **E, G, A, H**) behind the existing
   `upgrade()` entry points. Storage is preserved across `upgrade()`.
2. **Migration note (layout-changing levers A, H):** packing keys into one struct
   changes storage layout for existing users. Prefer **lazy migration** — read
   old keys as a fallback and write the new packed struct on the user's next
   interaction. Zero admin cost, no big batch tx, no disruption. Avoid a forced
   `migrate_*()` batch unless necessary.
3. **Lever G minter swap (do in this exact order to stay secure):**
   a. `set_minter(leaderboard, true)` on the token.
   b. Upgrade leaderboard with the new `reward()` that mints internally.
   c. Upgrade market to call the single `reward()` instead of `add_pts` + `mint`.
   d. `set_minter(market, false)` on the token (least privilege) — only after (c)
      is confirmed working.
4. Verify on **testnet** first: full place_bet → resolve → claim → register cycle,
   confirm the resource-fee drop in simulation, confirm rewards still land and the
   re-entrancy guard order is intact, THEN `upgrade()` mainnet (cost ~1–2 XLM total
   across the 2–3 contracts touched).
5. Update the frontend's first-bet/claim fee note copy with the new lower number.

**Contracts touched:** leaderboard (E, F, G, H), prediction_market (G, C),
referral_registry (A, G), PULSE_token (minter authorization only — no logic
change). Upload cost scales with WASM size; current sizes are small
(market 44KB, others <17KB), so each upgrade is well under 1 XLM.

---

## 6. UX backstop (ship regardless)

Independent of the contract work, add a one-line note in the betting / register
panels: *"Your first action on PULSE includes a small one-time on-chain
storage fee. Everything after that is nearly free."* Users abandon over
**surprise** fees, not understood ones. This requires no contract change and
should ship first.

