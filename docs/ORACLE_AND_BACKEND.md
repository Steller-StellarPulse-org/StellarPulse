# StellarPulse — Oracle & Backend Architecture

> **Status:** Design document only. Not implemented.
> These systems are planned for Phase 2 after mainnet launch.
> Current contract resolution is admin/resolver-controlled (documented in security audit).

---

## Part 1 — Oracle Architecture

### Why This Matters

The current contract uses a single admin or registered resolver to call `resolve_market(caller, market_id, outcome)`. This is a **trusted-party model** — if the resolver lies, users lose funds. For markets with real stakes, this is acceptable only as a transitional model. The oracle layer replaces or constrains this.

---

### Option A — Decentralized Oracle Network (Recommended for Phase 2)

**Model:** Multiple independent data providers submit outcomes. The contract accepts a resolution only when a threshold of providers agrees.

#### Contract Changes Required

```rust
// New DataKey variants
Submission(u64, Address),    // market_id → submitter → outcome
SubmissionCount(u64),        // how many submissions for market_id
OracleProvider(Address),     // registered oracle providers

// New functions
fn register_oracle(env, admin, oracle: Address)
fn submit_outcome(env, oracle: Address, market_id: u64, outcome: bool)
fn finalize_market(env, market_id: u64)  // callable by anyone once threshold met
```

#### Resolution Flow

```
1. Market expires (end_time passed)
2. N oracle providers independently query their data sources
3. Each provider calls submit_outcome(market_id, outcome)
4. When ≥ THRESHOLD providers agree (e.g. 3-of-5):
   - finalize_market() can be called by anyone
   - market.resolved = true, market.outcome = majority_vote
5. If threshold not met within DISPUTE_WINDOW:
   - Market enters dispute state
   - Admin can force-resolve or cancel
```

#### THRESHOLD and DISPUTE_WINDOW constants

```rust
const ORACLE_THRESHOLD: u32 = 3;     // minimum agreements required
const ORACLE_WINDOW: u64 = 86400;    // 24 hours after expiry to submit
const DISPUTE_WINDOW: u64 = 172800;  // 48 hours to dispute
```

#### Data Sources per Category

| Category | Primary Source | Secondary | Tertiary |
|---|---|---|---|
| Crypto | CoinGecko API | Binance API | CoinMarketCap |
| Sports | SportDataAPI | TheOddsAPI | ESPN Feed |
| Politics | Metaculus API | PolyMarket feed | Reuters |
| Science | Custom committee | Research publication | Admin override |

---

### Option B — Optimistic Oracle (For Binary Markets)

**Model:** Anyone can submit an outcome. There is a challenge period. If unchallenged, it finalizes. If challenged, escalates to a dispute council.

#### States

```
OPEN → SUBMITTED (anyone posts outcome + bond)
     → CHALLENGED (disputer posts larger bond within 24h)
       → ESCALATED (council vote within 72h)
         → FINALIZED (council decision, bonds distributed)
     → FINALIZED (unchallenged after 24h)
```

#### Bond Mechanics

```rust
const SUBMITTER_BOND: i128 = 100_0000000;  // 100 XLM
const DISPUTER_BOND:  i128 = 200_0000000;  // 200 XLM (must exceed submitter)

// If submitter is correct: submitter gets bond back + half of disputer bond
// If disputer is correct: disputer gets both bonds
// Council fee: 10% of loser's bond
```

#### Why Optimistic Works for PULSE

- Most markets are uncontroversial (BTC price, sports scores)
- Fast resolution for obvious outcomes (bond posted, no challenge → auto-finalize in 24h)
- Challenge mechanism adds security for disputed outcomes
- No oracle providers need to be registered in advance

---

### Option C — Resolution Council (Multisig Governance)

**Model:** A council of N addresses votes on market outcomes. Requires M-of-N approval. Has timelocks.

```rust
const COUNCIL_SIZE: u32 = 7;
const COUNCIL_THRESHOLD: u32 = 4;   // 4-of-7
const TIMELOCK: u64 = 43200;        // 12 hours after threshold before finalization
```

This is the **simplest to implement** and the right choice for Phase 1.5 (before full oracle). The current single-admin resolver can be upgraded to a 4-of-7 council by:

1. Deploying a governance contract
2. Adding 7 trusted addresses as council members via `add_resolver()`
3. Requiring all 7 to submit their `resolve_market()` calls
4. Using an off-chain aggregator to detect when 4 agree and submit the final resolution

This requires **zero contract changes** to the current implementation.

---

### Hybrid Architecture (Final Recommendation)

```
Phase 1 (Now):        Admin + Trusted Resolvers (current)
Phase 1.5 (3 months): 4-of-7 Council Multisig (zero contract changes needed)
Phase 2 (6 months):   Optimistic Oracle with dispute window
Phase 3 (12 months):  Full DNN with on-chain consensus
```

---

### Oracle Monitoring Requirements

When the oracle layer is implemented, every submission must be monitored:

```typescript
// Events to watch for
interface OracleEvent {
  type: "submission" | "challenge" | "finalization" | "dispute"
  marketId: number
  submitter: string
  outcome: boolean
  timestamp: number
  bond?: number
}

// Alerting thresholds
const ALERTS = {
  marketUnresolvedHoursAfterExpiry: 6,
  conflictingSubmissions: true,
  bondBelowMinimum: true,
  councilInactivity: 48, // hours
}
```

---

## Part 2 — Backend Architecture

> **Not implemented.** The current frontend reads directly from Soroban RPC.
> This is fine for <100 markets but will not scale beyond ~500 markets.

---

### Why a Backend Is Needed

The current `getMarkets()` function calls `get_market_count`, then fires N parallel RPC calls (batch of 5). At:

- 50 markets: ~2 seconds load time ✓
- 500 markets: ~20 seconds ✗
- 5,000 markets: ~200 seconds ✗✗✗
- 10,000 markets: unusable

The Soroban RPC endpoint also has rate limits (~50 req/s per IP on public nodes). At launch with 10,000 users all loading the markets page simultaneously, **the public RPC will throttle you.**

---

### Backend Stack

```
┌──────────────────────────────────────────────────┐
│                   Next.js Frontend               │
│  (reads from Backend API, not directly from RPC) │
└────────────────────┬─────────────────────────────┘
                     │  REST / GraphQL
┌────────────────────▼─────────────────────────────┐
│               Backend API (Node.js)              │
│  - GET /markets?filter=active&page=1&limit=20    │
│  - GET /markets/:id                              │
│  - GET /markets/:id/bets                         │
│  - GET /leaderboard?offset=0&limit=20            │
│  - POST /markets/:id/resolve  (oracle trigger)   │
└────────────────────┬─────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐    ┌───────────▼──────────┐
│  PostgreSQL DB │    │  Redis Cache         │
│  (indexed      │    │  (30s TTL for        │
│   market data) │    │   market data)       │
└───────┬────────┘    └───────────┬──────────┘
        │                         │
        └────────────┬────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│          Soroban Event Indexer                   │
│  - Polls getEvents() every 5 seconds             │
│  - Writes new markets/bets/claims to PostgreSQL  │
│  - Invalidates Redis cache on updates            │
└──────────────────────────────────────────────────┘
```

---

### Database Schema

```sql
-- Markets table (indexed copy of on-chain data)
CREATE TABLE markets (
  id            BIGINT PRIMARY KEY,
  question      TEXT NOT NULL,
  image_url     TEXT,
  category      VARCHAR(20) NOT NULL,
  end_time      BIGINT NOT NULL,
  total_yes     NUMERIC(30,7) NOT NULL DEFAULT 0,
  total_no      NUMERIC(30,7) NOT NULL DEFAULT 0,
  resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  outcome       BOOLEAN,
  cancelled     BOOLEAN NOT NULL DEFAULT FALSE,
  creator       CHAR(56) NOT NULL,
  bet_count     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_markets_category ON markets(category);
CREATE INDEX idx_markets_resolved  ON markets(resolved, end_time);
CREATE INDEX idx_markets_active    ON markets(resolved, cancelled, end_time);

-- Bets table
CREATE TABLE bets (
  market_id   BIGINT REFERENCES markets(id),
  bettor      CHAR(56) NOT NULL,
  net_amount  NUMERIC(30,7) NOT NULL,
  gross_amount NUMERIC(30,7) NOT NULL,
  is_yes      BOOLEAN NOT NULL,
  claimed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (market_id, bettor)
);

CREATE INDEX idx_bets_bettor ON bets(bettor);

-- Leaderboard (snapshot cache, rebuilt from events)
CREATE TABLE leaderboard (
  address     CHAR(56) PRIMARY KEY,
  display_name VARCHAR(50),
  points      BIGINT NOT NULL DEFAULT 0,
  won_bets    INTEGER NOT NULL DEFAULT 0,
  lost_bets   INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lb_points ON leaderboard(points DESC);

-- Events log (raw on-chain events for audit trail)
CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  ledger_seq  BIGINT NOT NULL,
  tx_hash     CHAR(64) NOT NULL,
  event_type  VARCHAR(50) NOT NULL,
  market_id   BIGINT,
  actor       CHAR(56),
  payload     JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_market   ON events(market_id);
CREATE INDEX idx_events_type     ON events(event_type);
CREATE INDEX idx_events_ledger   ON events(ledger_seq DESC);
```

---

### Soroban Event Indexer

```typescript
// indexer/src/index.ts
import { rpc, xdr, scValToNative } from "@stellar/stellar-sdk";

const POLL_INTERVAL_MS = 5_000;
const EVENTS_PER_PAGE = 200;

async function indexEvents(fromLedger: number): Promise<number> {
  const server = new rpc.Server(process.env.SOROBAN_RPC_URL!);

  const response = await server.getEvents({
    startLedger: fromLedger,
    filters: [
      { type: "contract", contractIds: [process.env.MARKET_CONTRACT_ID!] }
    ],
    limit: EVENTS_PER_PAGE
  });

  for (const event of response.events) {
    const topics = event.topic.map(t => scValToNative(t));
    const data = scValToNative(event.value);
    await writeEventToDb(event.ledger, event.txHash, topics, data);
  }

  return response.latestLedger;
}

async function writeEventToDb(ledger, txHash, topics, data) {
  const type = topics[0] as string;

  switch (type) {
    case "mkt": {
      if (topics[1] === "created") {
        await db.query(
          `INSERT INTO markets (id, question, category, end_time, creator)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [data[0], data[1], data[2], data[3], data[4]]
        );
      }
      if (topics[1] === "resolved") {
        await db.query(
          `UPDATE markets SET resolved=true, outcome=$2, updated_at=NOW()
           WHERE id=$1`,
          [data.market_id, data.outcome]
        );
        await redis.del(`market:${data.market_id}`);
        await redis.del("markets:active");
      }
      break;
    }
    case "bet": {
      await db.query(
        `INSERT INTO bets (market_id, bettor, net_amount, is_yes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (market_id, bettor) DO UPDATE
         SET net_amount = bets.net_amount + EXCLUDED.net_amount`,
        [data.market_id, data.user, data.net, data.is_yes]
      );
      break;
    }
  }
}

// Main polling loop
let lastLedger = await getCheckpoint();
while (true) {
  lastLedger = await indexEvents(lastLedger);
  await saveCheckpoint(lastLedger);
  await sleep(POLL_INTERVAL_MS);
}
```

---

### API Endpoints

```
GET  /api/markets
     ?filter=active|resolved|ended|cancelled
     &category=Crypto|Sports|Politics|Entertainment|Science
     &sort=newest|volume|ending_soon|bettors
     &page=1&limit=20
     Response: { markets: Market[], total: number, page: number }

GET  /api/markets/:id
     Response: Market (with real-time data from DB, refreshed every 30s)

GET  /api/markets/:id/bets
     ?page=1&limit=50
     Response: { bets: Bet[], total: number }

GET  /api/leaderboard
     ?offset=0&limit=20&sort=points|bets
     Response: { players: PlayerStats[], total: number }

GET  /api/stats
     Response: { totalMarkets, totalVolume, totalUsers, totalBets }

POST /api/oracle/submit
     Body: { marketId, outcome, signature, provider }
     Auth: Bearer token (oracle provider API key)
     Response: { accepted: boolean, submissionsNeeded: number }
```

---

### Caching Strategy

```typescript
// Redis cache keys and TTLs
const CACHE = {
  "markets:all":           30_000,   // 30s — full market list
  "markets:active":        15_000,   // 15s — active markets (changes more)
  "market:{id}":           30_000,   // 30s per market
  "leaderboard:top20":     60_000,   // 1 minute
  "stats:global":          60_000,   // 1 minute
  "bets:{market_id}":      30_000,   // 30s per market's bet list
};

// Cache invalidation on events
// - market created → invalidate markets:all, markets:active
// - bet placed     → invalidate market:{id}, markets:active
// - market resolved → invalidate all market caches, leaderboard
```

---

### Rate Limiting

```typescript
// Per-IP limits (using Redis sliding window)
const RATE_LIMITS = {
  "GET /api/markets":     { requests: 60,  window: 60 },   // 60 req/min
  "GET /api/markets/:id": { requests: 120, window: 60 },   // 120 req/min
  "POST /api/oracle/*":   { requests: 10,  window: 60 },   // 10 req/min
  "default":              { requests: 30,  window: 60 },   // 30 req/min
};
```

---

### Infrastructure

```yaml
# docker-compose.production.yml
services:
  api:
    image: PULSE-api:latest
    replicas: 3
    env:
      - SOROBAN_RPC_URL=https://mainnet.sorobanrpc.com
      - MARKET_CONTRACT_ID=${MARKET_CONTRACT_ID}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}

  indexer:
    image: PULSE-indexer:latest
    replicas: 1  # single indexer, writes to shared DB
    env:
      - SOROBAN_RPC_URL=https://mainnet.sorobanrpc.com

  postgres:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
```

---

### Monitoring

```typescript
// Key metrics to track (Prometheus + Grafana)
const METRICS = {
  // Blockchain health
  "indexer_lag_ledgers":      "gauge",   // how far behind the indexer is
  "rpc_errors_total":         "counter", // RPC call failures
  "events_processed_total":   "counter", // events indexed

  // Application health
  "api_request_duration_ms":  "histogram",
  "cache_hit_rate":           "gauge",
  "db_query_duration_ms":     "histogram",

  // Business metrics
  "markets_created_total":    "counter",
  "bets_placed_total":        "counter",
  "volume_xlm_total":         "counter",
  "markets_resolved_total":   "counter",

  // Oracle health (Phase 2)
  "oracle_submissions_total": "counter",
  "oracle_disputes_total":    "counter",
  "oracle_resolution_lag_h":  "gauge",
};

// Alerts
const ALERTS = [
  { name: "IndexerStalled",     condition: "indexer_lag_ledgers > 100" },
  { name: "HighRPCErrorRate",   condition: "rpc_errors_total rate > 5/min" },
  { name: "MarketStuck",        condition: "market unresolved > 48h past expiry" },
  { name: "HighAPILatency",     condition: "api_p99 > 2000ms" },
  { name: "DatabaseSlow",       condition: "db_query_p99 > 500ms" },
];
```

---

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    steps:
      - run: cd contracts && cargo test
      - run: cd frontend && npx tsc --noEmit
      - run: cd frontend && npx vitest run
      - run: cd frontend && npm run build

  security:
    steps:
      - run: cd contracts && cargo audit
      - run: npm audit --audit-level=high
      - name: Check for hardcoded secrets
        run: grep -rn "SBNZ\|seed_phrase" frontend/src/ contracts/ && exit 1 || exit 0

  deploy:
    needs: [test, security]
    steps:
      - name: Deploy contracts (manual gate)
        if: github.event.inputs.deploy_contracts == 'true'
        run: bash scripts/deploy-mainnet.sh

      - name: Deploy frontend
        run: vercel deploy --prod

      - name: Deploy backend
        run: docker-compose -f docker-compose.production.yml up -d
```

---

## Summary: Implementation Priority

| Component | Priority | Effort | Needed Before |
|---|---|---|---|
| 4-of-7 council resolvers | **P0** | 1 day | Any real-money launch |
| Backend API + DB indexer | **P0** | 2 weeks | >100 markets |
| Redis caching layer | P1 | 3 days | >1000 users |
| Optimistic oracle | P1 | 3 weeks | High-stakes markets |
| Prometheus + Grafana | P1 | 1 week | Production monitoring |
| Full DNN integration | P2 | 3 months | Phase 3 |
| Dispute mechanism | P2 | 6 weeks | Phase 2 |

