# StellarPulse

A compact, production-oriented prediction market built on Stellar + Soroban.

StellarPulse is a monorepo containing on-chain smart contracts (Soroban/Rust)
and a modern Next.js frontend. This repository includes the core contracts,
front-end app, tests, and deployment helpers so you can run, test, and
iterate locally or deploy to a network.

Author: WITTIG

---

## Quick Start

Requirements:
- Rust + Cargo (stable toolchain)
- `soroban`/`wasm` toolchain for Soroban contract builds
- Node.js 18+ and pnpm/npm/yarn
- Git

Clone and open the repo:

```bash
git clone https://github.com/Steller-StellarPulse-org/StellarPulse.git
cd StellarPulse
```

Run the frontend locally:

```bash
cd frontend
npm install
npm run dev
# then open http://localhost:3000
```

Build and test contracts (basic):

```bash
cd contracts
cargo test --workspace
```

Run the full test suite (frontend + contracts):

```bash
# contracts
cd contracts && cargo test
# frontend tests
cd ../frontend && npm run test
```

---

## Repository Layout

- `contracts/` — Soroban smart contracts written in Rust. Sub-crates include
  `prediction_market`, `ipredict_token`, `referral_registry`, and `leaderboard`.
- `frontend/` — Next.js 14 frontend (App Router) with Tailwind CSS and TypeScript.
- `scripts/` — deployment and helper scripts for testnet/mainnet flows.

---

## Development Notes

- Frontend runs on `http://localhost:3000` by default. Environment config is in
  `frontend/src/config` and uses simple env variables for RPC endpoints.
- Contracts are organized as independent crates to enable targeted testing and
  isolated upgrades.
- Tests for contracts use standard Rust test harnesses; frontend uses Vitest.

Suggested workflow:

1. Implement or change contract logic in `contracts/<crate>/src`.
2. Run `cargo test -p <crate>` to validate contract unit tests.
3. Update or test frontend integration in `frontend/`.
4. Commit small, focused changes and push a descriptive message.

---

## Contributing

Contributions are welcome. Please open issues for bugs or features, and use
feature branches for non-trivial changes. Keep commits small and message
clearly — this repository values readable history.

If you intend to rewrite history or force-push, coordinate with maintainers.

---

## License

This project uses the MIT license. See `LICENSE` for details.

---

If you want a more detailed README (architecture diagrams, example calls,
deployment steps, or how to interact with the contracts), tell me what to
include and I will expand this file.

## Deployed Contracts (Stellar Mainnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| Prediction Market | `CDGNPRYTFDXJLWZE4YDKZXW4IEN2RLPSE4N7VM5HJ7NLPL2QC45GIXI5` | [stellar.expert](https://stellar.expert/explorer/public/contract/CDGNPRYTFDXJLWZE4YDKZXW4IEN2RLPSE4N7VM5HJ7NLPL2QC45GIXI5) |
| PULSE Token | `CAYL4TKNRMXAX5ZLQGFEZ6XOC2QHTCTN5QC2SB5BEEHLVO6SDU2UBLRH` | [stellar.expert](https://stellar.expert/explorer/public/contract/CAYL4TKNRMXAX5ZLQGFEZ6XOC2QHTCTN5QC2SB5BEEHLVO6SDU2UBLRH) |
| Referral Registry | `CAGJVX6EXMCKKWDJCQFIEJ34CZTHZOGLWJM6KQTGDEXEO723CJZ5773H` | [stellar.expert](https://stellar.expert/explorer/public/contract/CAGJVX6EXMCKKWDJCQFIEJ34CZTHZOGLWJM6KQTGDEXEO723CJZ5773H) |
| Leaderboard | `CCWWOQSDSO3XXLCMA6A2HYRUFYVNUJZ2HPAMFQSPOB4JWYIBY2HWVTOB` | [stellar.expert](https://stellar.expert/explorer/public/contract/CCWWOQSDSO3XXLCMA6A2HYRUFYVNUJZ2HPAMFQSPOB4JWYIBY2HWVTOB) |

> **Network:** Stellar Mainnet (Public) | **Admin:** `GDZ4VJWNJPLNU3PAWDYX3V5XNATO7X257DPHWRPFXSCCNEUZ7QTXIIUI` | **7 seed markets live** | All contracts upgradeable
>
> **Native XLM SAC:** `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` (mainnet)

---
## User Validation

> The table below records our **pre-launch testnet validation** — 30+ real users
> who tested the full flow (bet, claim, referral) on Stellar Testnet before the
> mainnet launch. These are historical testnet wallets, kept here as proof of
> product testing. Live mainnet activity is on the contracts listed above.

### Pre-Launch Testnet Users

| # | Wallet Address | Action | Points |
|---|----------------|--------|--------|
| 1 | `GDHQ6TNWZ4V2JVCDWEUVW7YKFBXCOQZRRUCT27LAKES3PGOE6JSZMSMD` | Admin — Created markets, placed bets, claimed rewards | 83 |
| 2 | `GA5OIFR4TLRJC54B3FIDWHIQKVFGVOWQFE3NXIIGCGLSGTJRUY6RHR2Q` | Placed bets, claimed rewards, referral registration | 38 |
| 3 | `GAIWJS35TTF2XMYGHY6AX6YBGI4IG3RWSEL2FEXV3DESW5RITGPWIIED` | Placed bets, claimed rewards, referral registration | 29 |
| 4 | `GA7GFCGUDLWZ6DIDCNERHA5CI7MATE6NT3MKDVJKFYIM5Y543OTLO3UY` | Placed bets, referral registration | 20 |
| 5 | `GDMA5FFWVJIOTBLO4XZWW5O4DWPOO33TLUOFCQQ7GPGTIRU6WXHCT4ZM` | Placed bets, referral registration | 17 |
| 6 | `GCSX2AGJRP747DWRCB3YYCKTXHU5CC6YNQUZPOCWWGA4DTK2PY5R6MUH` | Placed bets, referral registration | 8 |
| 7 | `GDKC2TFZVEJ7M7W2DLJZYFHK4AMHFX4JZKDP5JPQODBR7OT7C3RULXXA` | Placed bets, referral registration | 8 |
| 8 | `GAKY6JQSSCJZ3MQENCYAWIOZWGDKQJI7BCP6ZB35WTQZCMTYZ6M67UQG` | Placed bets, referral registration | 8 |
| 9 | `GCR32ST6YU3PLIOW7R6LRCB7ZMSSLAROMZGRQTK5CSOGW4GMIGMQGN5V` | Referral registration | 5 |
| 10 | `GA2LXPEKNP4IYZ2UKD4YUOGWPYMTNHGNXQRR2X3XT52XKQ5UV6BZKNFR` | Referral registration | 5 |
| 11 | `GCY4URAJ2JKE3UHCAEZHG5CTMVBS54S5IWQEWU3IIJX2ROOZ55YQYSOV` | Referral registration | 5 |
| 12 | `GDSSMRFIF56YMGR7DJY2DBQNQNLGJHJ5AW2DP3QSNVJVR4US6DTTM5YV` | Referral registration | 5 |
| 13 | `GB7M36KOEMNREMS4KMCXKUUYSHAT4JWEXLQJOFOEV3OA5SCUYYFEPGVO` | Referral registration | 5 |
| 14 | `GDD7MQAP2OE4NTEHLKNSUGIUMJN24RQL72ZTJAYGCDVULNP67JLUYGQW` | Referral registration | 5 |
| 15 | `GDUF4W7CEIM3JFGZFW4PTLWGCY3G3JD5P4WZMA4C6QFODLC7M6ASC3PU` | Referral registration | 5 |
| 16 | `GCXEQC2DIPFWPVR4JMROCYSB6YMP6TW3Q2YEV3IXTCRE4ZGSURKVL5LT` | Referral registration | 5 |
| 17 | `GBDFA2O72OOCUII5NWWKQ6G7V2EZ6D3GDWIYMCMQFVOAHFVAAM33ZOFZ` | Referral registration | 5 |
| 18 | `GACER5XK5SMHR64FZOELYPPLJVRWFBDY5UWCBOEBSLNK266Q2L45YD2P` | Referral registration | 5 |
| 19 | `GDKZYMCENO7VCOHIZRAV5OP26X5F6KV5ETT7L35WW6G7QWD4TVI72CXE` | Referral registration | 5 |
| 20 | `GCLS42CXE5GJGVNPBTF7YIJLI2QGO7LLZK5QFAGO7KPXRNQOLIUBZHFP` | Referral registration | 5 |
| 21 | `GAW5CACDFYE4T4U26IYYSEJTGXLU4HU5LREGTM4D5NLRPZSK5Y4YBVCE` | Referral registration | 5 |
| 22 | `GAWDCG7UCCJH4AOZPD45R4VPZG3XH7NVPIMZGNXT2BDKHMPRK6WSZXVV` | Referral registration | 5 |
| 23 | `GDQIMRXKQDDPXAAU6RQIXFG34GZPV2TEZWJTPE6IPSISG4P5GF5CZZ3B` | Referral registration | 5 |
| 24 | `GAEAQCVLZML7E74YYSA4VMACJWFZKABU774BDZ2PIOZC7QVQ3R3LKLPO` | Referral registration | 5 |
| 25 | `GAYU7KUVSIO2CQDMPN7GB62GTJTG73UYOBVO6RVV6WPOO45R2PTGABJI` | Referral registration | 5 |
| 26 | `GDJWQ5PBXYYRVQRMLZVRSKRCSJJBZNK2V7S5UN323JCUDK3D54YBUTM2` | Referral registration | 5 |
| 27 | `GCO7CTBLSFEGZKBYNWO34COSOON3FRAOM44HF23XLRV5QM72ZGV35ZL4` | Referral registration | 5 |
| 28 | `GBE663I55YXLC7U26GZBDUBHYXOYQFUXSXALDM2BXQRFUOPMFASGDGWQ` | Referral registration | 5 |
| 29 | `GBX3HFO3J6IPOXPH2BWPWKNSCFNMKGANMFJPBFC3JACIMBJM6UISGNZK` | Referral registration | 5 |
| 30 | `GASJLRNNMPYN3AIA6MFB6ETRDI5H5C36QRRXLFK62XZUJWGVK4YWNF6R` | Referral registration | 5 |
| 31 | `GBQI3WD2YKYUWB4MXOO3QP7DPENLV3WD32EHA43VV3US2DCBOWEPV7GW` | Referral registration | 5 |

*Pre-launch testnet wallets verifiable on [Stellar Expert Testnet Explorer](https://stellar.expert/explorer/testnet). Live mainnet contracts are linked in the Deployed Contracts section above.*

### User Feedback
- **Form Link that I shared with users:** [https://forms.gle/WrTyoCzQ6LJegL8a9](https://forms.gle/WrTyoCzQ6LJegL8a9)
- **The Spreadsheet with feedback:** [https://docs.google.com/spreadsheets/d/1rGhq1rgeDPiF6hI4iDL2eFt0vUMBDA6LSm9zS2txpiA/edit?usp=sharing](https://docs.google.com/spreadsheets/d/1rGhq1rgeDPiF6hI4iDL2eFt0vUMBDA6LSm9zS2txpiA/edit?usp=sharing)

---

## User Feedback Implementation: Added more filtering and default sorting options to the leaderboard on Active
|*User Name*| *User Email* | *User Wallet Adddress* | *Commit ID*|
|----------------------|-------------------------|-------------------------|----------------|
| best_bettor | `malyyen@gmail.com` | `GA7GFCGUDLWZ6DIDCNERHA5CI7MATE6NT3MKDVJKFYIM5Y543OTLO3UY` | `77c37784589046eeeb917a9015085dfa6fb26a52` |


## Advance Feature Added: Fee Sponsorship, Gasless Transactions
  > we added a Fee Sponsorship, Gasless Transactions feature to our MVP, allowing users to interact with the prediction market without needing to hold XLM for transaction fees. This significantly lowers the barrier to entry, enabling anyone to place bets and participate in the market seamlessly. The platform covers the transaction fees on behalf of the users, creating a more inclusive and user-friendly experience.


## Features

- **Binary Prediction Markets** — Bet YES or NO on any question with XLM
- **Inclusive Reward System** — Both winners AND losers earn points + PULSE tokens
- **Onchain Referral Program** — Share your link, earn 0.5% of every referred bet + bonus points
- **Real-Time Leaderboard** — Rankings by points, volume, and win rate from onchain data
- **Social Sharing** — One-tap sharing to X, Telegram, WhatsApp after every bet
- **4 Independent Smart Contracts** — Single responsibility, independently testable
- **Near-Zero Fees** — Only 2% total (1.5% platform + 0.5% referrer)
- **5-Second Finality** — Instant settlement on Stellar/Soroban
- **Mobile-First Design** — Fully responsive glassmorphic UI
- **Non-Custodial** — Your keys, your funds. Smart contracts handle everything

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js 14 Frontend                        │
│  (App Router • Tailwind CSS • Stellar Wallets Kit)             │
└──────────────┬──────────────┬──────────────┬──────────────┬─────┘
               │              │              │              │
        Soroban RPC      Soroban RPC    Soroban RPC    Soroban RPC
               │              │              │              │
  ┌────────────▼──┐ ┌────────▼────┐ ┌───────▼──────┐ ┌────▼────────┐
  │  Prediction   │ │  PULSE      │ │   Referral   │ │ Leaderboard │
  │    Market     │ │    Token    │ │   Registry   │ │             │
  │               │ │             │ │              │ │             │
  │ create_market │ │ mint        │ │ register     │ │ add_pts     │
  │ place_bet ────┼─┼─► mint ◄───┼─┤ credit ──────┼─┤ record_bet  │
  │ resolve    ───┼─┼─► mint     │ │ get_referrer │ │ get_stats   │
  │ claim      ───┼─┼─► mint     │ │ get_earnings │ │ get_top     │
  │ cancel        │ │ transfer   │ │ is_registered│ │ get_rank    │
  │ withdraw_fees │ │ balance    │ │              │ │             │
  └───────────────┘ └────────────┘ └──────────────┘ └─────────────┘
```

### Inter-Contract Call Flow

**Place Bet:** `PredictionMarket.place_bet()` → Transfers XLM via SAC → `ReferralRegistry.credit()` (splits fee: 0.5% to referrer, 1.5% to platform) → `Leaderboard.record_bet()` → `PulseToken.mint()` (bet participation tokens)

**Resolve Market:** `PredictionMarket.resolve_market()` → Stores outcome onchain

**Claim Reward:** `PredictionMarket.claim()` → Calculates pro-rata payout → Transfers XLM to user → `Leaderboard.add_pts()` (win: 30 pts / lose: 10 pts) → `PulseToken.mint()` (win: 10 PLSE / lose: 2 PLSE)

**Referral Registration:** `ReferralRegistry.register_referral()` → `Leaderboard.add_bonus_pts()` (5 pts) → `PulseToken.mint()` (1 PLSE welcome bonus)

---

## Reward System

| Outcome | XLM Payout | Points | PULSE Tokens |
|---------|-----------|--------|-----------------|
| **Win** | Pro-rata share of losing pool | +30 pts | +10 PLSE |
| **Lose** | 0 XLM | +10 pts | +2 PLSE |
| **Cancelled** | Full refund | +10 pts | +2 PLSE |
| **Referral Registration** | — | +5 pts | +1 PLSE |
| **Referred Bet** (referrer earns) | 0.5% of bet | +3 pts | — |

### Payout Formula

$$\text{Payout} = \frac{\text{UserBet}}{\text{WinningSidePool}} \times \text{TotalPool}$$

### Fee Model

| Component | Rate | Recipient |
|-----------|------|-----------|
| Platform fee | 1.5% | Admin (accumulated, withdrawable) |
| Referral fee | 0.5% | Referrer's XLM wallet |
| **Total** | **2.0%** | Deducted at bet time |

*If bettor has no referrer, full 2% goes to platform.*

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Smart Contracts** | Rust + Soroban SDK | 1.85.0 / 20.3.1 |
| **Frontend** | Next.js (App Router) | 14.2.35 |
| **UI** | React + Tailwind CSS | 18.3.1 / 3.4.17 |
| **Language** | TypeScript | 5.7.3 |
| **Wallet** | Stellar Wallets Kit | Freighter, xBull, Albedo |
| **Testing** | Vitest + Testing Library | 2.1.9 |
| **Contract Testing** | `#[test]` + soroban-sdk testutils | — |
| **CI/CD** | GitHub Actions | Node 18/20 + Rust |
| **Deployment** | Vercel (frontend) + Stellar Mainnet | — |

---

## Project Structure

```
stellarpulse/
├── .github/workflows/ci.yml       # CI pipeline (2 jobs)
├── contracts/
│   ├── Cargo.toml                  # Workspace manifest
│   ├── prediction_market/          # Core market logic (36 tests)
│   ├── pulse_token/             # Platform token (11 tests)
│   ├── referral_registry/          # Referral tracking (13 tests)
│   └── leaderboard/                # Rankings + stats (10 tests)
├── frontend/
│   ├── public/                     # Favicon, OG image
│   ├── src/
│   │   ├── app/                    # Next.js pages (7 routes)
│   │   ├── components/             # 30+ React components
│   │   │   ├── layout/             # Navbar, Footer, MobileMenu
│   │   │   ├── market/             # MarketCard, BettingPanel, OddsBar…
│   │   │   ├── leaderboard/        # LeaderboardTable, Tabs, PlayerRow
│   │   │   ├── profile/            # BetHistory, PointsCard, Referral…
│   │   │   ├── social/             # ShareBetButton, SocialShareModal
│   │   │   ├── wallet/             # WalletConnect, WalletModal
│   │   │   ├── admin/              # CreateMarket, Resolve, Stats
│   │   │   └── ui/                 # Spinner, Skeleton, Toast, Badge…
│   │   ├── hooks/                  # useMarket, useWallet, useBet…
│   │   ├── services/               # Soroban RPC service layer
│   │   ├── utils/                  # Helpers, cache, formatting
│   │   ├── config/                 # Network constants
│   │   └── types/                  # TypeScript interfaces
│   ├── __tests__/                  # 9 test suites (137 tests)
│   └── .env.local.example          # Environment template
└── README.md
```

---

## Getting Started

### Prerequisites

- **Rust** ≥ 1.85.0 with `wasm32-unknown-unknown` target
- **Node.js** ≥ 18
- **Stellar CLI** (`stellar-cli` or `soroban-cli`)
- **Freighter Wallet** browser extension (for mainnet interaction)

### Setup

```bash
# Clone
git clone https://github.com/Steller-StellarPulse-org/StellarPulse.git
cd StellarPulse

# Build smart contracts
cd contracts
stellar contract build
cargo test   # 70 tests

# Setup frontend
cd ../frontend
cp .env.local.example .env.local

# Edit .env.local with your deployed contract IDs
npm install
npm test     # 137 tests
npm run build
npm run dev  # http://localhost:3000
```

### Deploy Contracts (Testnet for dev, Mainnet for production)

See [docs/DEPLOYMENT-GUIDE.md](docs/DEPLOYMENT-GUIDE.md) for the full step-by-step deployment guide with correct dependency order.

---

## Testing

### Summary

| Suite | Tests | Status |
|-------|-------|--------|
| **Prediction Market** (Rust) | 36 | ✅ All passing |
| **Referral Registry** (Rust) | 13 | ✅ All passing |
| **PULSE Token** (Rust) | 11 | ✅ All passing |
| **Leaderboard** (Rust) | 10 | ✅ All passing |
| **Frontend Helpers** | 49 | ✅ All passing |
| **Frontend Cache** | 20 | ✅ All passing |
| **BettingPanel Component** | 13 | ✅ All passing |
| **MarketCard Component** | 10 | ✅ All passing |
| **LeaderboardTable Component** | 10 | ✅ All passing |
| **Navbar Component** | 7 | ✅ All passing |
| **WalletConnect Component** | 6 | ✅ All passing |
| **Market Service** | 12 | ✅ All passing |
| **Leaderboard Service** | 10 | ✅ All passing |
| **Total** | **207** | **✅ All passing** |

### Run Tests

```bash
# Rust contract tests
cd contracts && cargo test

# Frontend tests
cd frontend && npm test

# Frontend tests with coverage
cd frontend && npx vitest run --coverage
```

---

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `main`/`develop` and every PR to `main`.

### Job 1: `lint-test-build`
- **Matrix:** Node.js 18, 20
- **Steps:** `npm ci` → `npm test` → `npm run build`
- **Artifacts:** Production build uploaded on Node 20

### Job 2: `contract-check`
- **Toolchain:** Rust stable + `wasm32-unknown-unknown` target
- **Steps:** `cargo check --workspace` → `cargo test --workspace`
- **Cache:** Cargo registry + target directory cached

---

### Feedback & Iteration

See [docs/USER-FEEDBACK.md](docs/USER-FEEDBACK.md) for the full feedback log.

**Iteration Summary:** After initial testnet deployment, user feedback on loading states led to replacing spinner-only loading indicators with content-aware skeleton placeholders across leaderboard, profile, and market detail pages — improving perceived performance and reducing layout shift.

---

## Smart Contract Functions

### Prediction Market

| Function | Description |
|----------|-------------|
| `initialize(admin, token, referral, leaderboard, xlm_sac)` | One-time setup with linked contracts |
| `create_market(admin, question, image_url, duration_secs)` | Create new prediction market |
| `place_bet(user, market_id, is_yes, amount)` | Place or increase bet (2% fee deducted) |
| `resolve_market(admin, market_id, outcome)` | Admin resolves with YES/NO outcome |
| `cancel_market(admin, market_id)` | Cancel market, enable refunds |
| `claim(user, market_id)` | Claim payout + points + tokens |
| `withdraw_fees(admin)` | Admin withdraws accumulated platform fees |
| `get_market(market_id)` | Read market data |
| `get_bet(market_id, user)` | Read user's bet on market |
| `get_market_count()` | Total markets created |
| `get_odds(market_id)` | Current YES/NO percentages |
| `get_market_bettors(market_id)` | List all bettors on a market |
| `get_accumulated_fees()` | Total unclaimed platform fees |

### PULSE Token

| Function | Description |
|----------|-------------|
| `initialize(admin, name, symbol, decimals)` | One-time token setup |
| `set_minter(minter)` | Authorize address to mint (multi-minter) |
| `remove_minter(minter)` | Revoke minting rights |
| `mint(minter, to, amount)` | Mint tokens (authorized minters only) |
| `transfer(from, to, amount)` | Transfer tokens between accounts |
| `burn(from, amount)` | Burn tokens |
| `balance(account)` | Get token balance |
| `total_supply()` | Total tokens minted |
| `name()` / `symbol()` / `decimals()` | Token metadata |

### Referral Registry

| Function | Description |
|----------|-------------|
| `initialize(admin, market, token, leaderboard, xlm_sac)` | One-time setup |
| `register_referral(user, display_name, referrer?)` | Register with optional referrer |
| `credit(caller, user, referral_fee)` | Credit referral fee (called by market contract) |
| `get_referrer(user)` | Get user's referrer address |
| `get_display_name(user)` | Get registered display name |
| `get_referral_count(user)` | Number of referrals |
| `get_earnings(user)` | Total referral earnings |
| `has_referrer(user)` / `is_registered(user)` | Status checks |

### Leaderboard

| Function | Description |
|----------|-------------|
| `initialize(admin, market, referral)` | One-time setup |
| `add_pts(caller, user, points, is_winner)` | Add win/loss points + update stats |
| `add_bonus_pts(caller, user, points)` | Add bonus points (no stat inflation) |
| `record_bet(caller, user)` | Increment total bets count |
| `get_points(user)` | Get user's total points |
| `get_stats(user)` | Full player stats (points, bets, wins, losses) |
| `get_top_players(limit)` | Sorted leaderboard |
| `get_rank(user)` | User's current rank |

---

## Roadmap

| Phase | Timeline | Milestone |
|-------|----------|-----------|
| **Foundation** | Feb 2026 | MVP launch, testnet, core markets |
| **Growth** | Q2 2026 | User-created markets, oracle resolution, categories |
| **Token Utility** | Q3 2026 | PULSE staking, governance, reward tiers |
| **Scale** | Q4 2026 | Mainnet launch, mobile app, cross-chain bridges |

---

## License

[MIT](LICENSE)

---

## Author

Built by **WITTIG** for the Stellar Build-a-10M-Startup challenge.

- Stellar Admin Wallet: `GDHQ6TNWZ4V2JVCDWEUVW7YKFBXCOQZRRUCT27LAKES3PGOE6JSZMSMD`


# StellarPulse

## Contributors (Wave)

Thanks to everyone shipping Wave tasks. To get credit:

1. Open a PR that references the Wave issue (e.g. `Fixes #28`).
2. Keep the PR focused on the acceptance criteria.
3. After merge, add yourself below (name + GitHub handle + issue number).

| Contributor | GitHub | Wave issue |
|---|---|---|
| Example | @your-handle | #28 |

Maintainers may also shout out merged Wave PRs in release notes.
