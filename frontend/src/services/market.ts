import {
  Address,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { MARKET_CONTRACT_ID } from "@/config/network";
import { buildAndSendTx, simulateTransaction, getSimulationSource } from "@/services/soroban";
import * as cache from "@/services/cache";
import { getDisplayName } from "@/services/referral";
import type { Market, Bet, MarketCategory, TransactionResult } from "@/types";

// ── Cache keys & TTLs ────────────────────────────────────────────────────────

const CACHE_MARKETS = "markets";
const CACHE_MARKET = (id: number) => `market_${id}`;
const CACHE_BET = (mId: number, addr: string) => `bet_${mId}_${addr}`;
const CACHE_BETTORS = (id: number) => `bettors_${id}`;
const CACHE_FEES = "accumulated_fees";

const MARKET_TTL = 30_000;
const BET_TTL = 15_000;

// ── Stroops conversion ────────────────────────────────────────────────────────
const STROOPS_PER_XLM = 10_000_000n;

function stroopsToXlm(stroops: bigint): number {
  // Convert to number after dividing — safe because result fits in f64
  return Number(stroops) / Number(STROOPS_PER_XLM);
}

function xlmToStroops(xlm: number): bigint {
  // Round to nearest stroop before converting to BigInt
  return BigInt(Math.round(xlm * Number(STROOPS_PER_XLM)));
}

// ── Helpers: build ScVal args ─────────────────────────────────────────────────

function addressVal(addr: string): xdr.ScVal {
  return new Address(addr).toScVal();
}

/** u64 — use BigInt to avoid JS number precision loss above 2^53 */
function u64Val(n: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(n), { type: "u64" });
}

/** i128 — use BigInt to avoid precision loss */
function i128Val(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: "i128" });
}

function boolVal(b: boolean): xdr.ScVal {
  return nativeToScVal(b, { type: "bool" });
}

function stringVal(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: "string" });
}

/**
 * Build an ScVal for the Category enum variant.
 *
 * A Soroban `#[contracttype]` UNIT enum variant is encoded as:
 *   scvVec([ scvSymbol("Crypto") ])   →   ["Crypto"]
 *
 * NOT as a map. Using scvMap ({ "Crypto": null }) causes the contract's
 * Category deserializer to trap with "UnreachableCodeReached" / WasmVm
 * InvalidAction. Verified on mainnet: the vec-symbol form is the only one
 * create_market accepts.
 */
function categoryVal(cat: MarketCategory): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(cat)]);
}


// ── Parse raw contract data into TS types ─────────────────────────────────────

function parseCategory(raw: unknown): MarketCategory {
  const valid: MarketCategory[] = ["Crypto", "Sports", "Politics", "Entertainment", "Science", "Other"];

  if (typeof raw === "string" && valid.includes(raw as MarketCategory)) {
    return raw as MarketCategory;
  }
  // scValToNative may return { Crypto: undefined } or ["Crypto"] shape
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const key = Object.keys(raw as object)[0] as MarketCategory;
    if (key && valid.includes(key)) return key;
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
    const key = raw[0] as MarketCategory;
    if (valid.includes(key)) return key;
  }
  return "Other";
}

interface RawMarket {
  id: number | bigint;
  question: string;
  image_url: string;
  category: unknown;
  end_time: number | bigint;
  total_yes: number | bigint;
  total_no: number | bigint;
  resolved: boolean;
  outcome: boolean;
  cancelled: boolean;
  creator: string;
  bet_count: number | bigint;
}

function parseMarket(raw: RawMarket): Market {
  return {
    id: Number(raw.id),
    question: raw.question,
    imageUrl: raw.image_url,
    category: parseCategory(raw.category),
    endTime: Number(raw.end_time),
    totalYes: stroopsToXlm(BigInt(raw.total_yes)),
    totalNo: stroopsToXlm(BigInt(raw.total_no)),
    resolved: raw.resolved,
    outcome: raw.outcome,
    cancelled: raw.cancelled,
    creator: typeof raw.creator === "string" ? raw.creator : String(raw.creator),
    betCount: Number(raw.bet_count),
  };
}

interface RawBet {
  amount: number | bigint;
  is_yes: boolean;
  claimed: boolean;
}

function parseBet(raw: RawBet): Bet {
  return {
    amount: stroopsToXlm(BigInt(raw.amount)),
    isYes: raw.is_yes,
    claimed: raw.claimed,
  };
}

// ── Concurrency limiter ───────────────────────────────────────────────────────

async function batchAll<T>(
  tasks: (() => Promise<T>)[],
  concurrency = 5
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency).map((fn) => fn());
    results.push(...(await Promise.all(batch)));
  }
  return results;
}

// ── Read functions ────────────────────────────────────────────────────────────

export async function getMarket(marketId: number): Promise<Market | null> {
  const cached = cache.get<Market>(CACHE_MARKET(marketId));
  if (cached) return cached;

  try {
    const raw = await simulateTransaction<RawMarket>(
      getSimulationSource(),
      MARKET_CONTRACT_ID,
      "get_market",
      [u64Val(marketId)]
    );
    const market = parseMarket(raw);
    cache.set(CACHE_MARKET(marketId), market, MARKET_TTL);
    return market;
  } catch {
    return null;
  }
}

export async function getMarkets(): Promise<Market[]> {
  const cached = cache.get<Market[]>(CACHE_MARKETS);
  if (cached) return cached;

  // Wrap count fetch in its own try/catch so a bad RPC doesn't kill everything
  let total = 0;
  try {
    const count = await simulateTransaction<number | bigint>(
      getSimulationSource(),
      MARKET_CONTRACT_ID,
      "get_market_count",
      []
    );
    total = Number(count);
  } catch {
    // RPC unavailable or contract not deployed — return empty gracefully
    return [];
  }

  if (total === 0) return [];

  const tasks = Array.from({ length: total }, (_, i) => {
    const id = i + 1;
    return async () => {
      try {
        const raw = await simulateTransaction<RawMarket>(
          getSimulationSource(),
          MARKET_CONTRACT_ID,
          "get_market",
          [u64Val(id)]
        );
        return parseMarket(raw);
      } catch {
        return null;
      }
    };
  });

  // Concurrency 15 so a typical board (≤15 markets) loads in one parallel wave.
  const results = await batchAll(tasks, 15);
  const markets = results.filter((m): m is Market => m !== null);

  for (const m of markets) {
    cache.set(CACHE_MARKET(m.id), m, MARKET_TTL);
  }
  cache.set(CACHE_MARKETS, markets, MARKET_TTL);
  return markets;
}

export async function getBet(
  marketId: number,
  userAddress: string
): Promise<Bet | null> {
  const cacheKey = CACHE_BET(marketId, userAddress);
  const cached = cache.get<Bet>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await simulateTransaction<RawBet>(
      getSimulationSource(),
      MARKET_CONTRACT_ID,
      "get_bet",
      [u64Val(marketId), addressVal(userAddress)]
    );
    const bet = parseBet(raw);
    cache.set(cacheKey, bet, BET_TTL);
    return bet;
  } catch {
    return null;
  }
}

export async function getMarketBettors(marketId: number): Promise<string[]> {
  const cacheKey = CACHE_BETTORS(marketId);
  const cached = cache.get<string[]>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await simulateTransaction<string[]>(
      getSimulationSource(),
      MARKET_CONTRACT_ID,
      "get_market_bettors",
      [u64Val(marketId)]
    );
    cache.set(cacheKey, raw, MARKET_TTL);
    return raw;
  } catch {
    return [];
  }
}

export async function getAccumulatedFees(): Promise<number> {
  const cached = cache.get<number>(CACHE_FEES);
  // Explicit null/undefined check — 0 is a valid cached value
  if (cached !== null && cached !== undefined) return cached;

  try {
    const raw = await simulateTransaction<number | bigint>(
      getSimulationSource(),
      MARKET_CONTRACT_ID,
      "get_accumulated_fees",
      []
    );
    const fees = stroopsToXlm(BigInt(raw));
    // Always set cache, including 0, so we don't re-fetch unnecessarily
    cache.set(CACHE_FEES, fees, MARKET_TTL);
    return fees;
  } catch {
    return 0;
  }
}

/** Fetch the gross bet amount (pre-fee) for a user on a cancelled market. */
export async function getBetGross(
  marketId: number,
  userAddress: string
): Promise<number> {
  try {
    const raw = await simulateTransaction<number | bigint>(
      getSimulationSource(),
      MARKET_CONTRACT_ID,
      "get_bet_gross",
      [u64Val(marketId), addressVal(userAddress)]
    );
    return stroopsToXlm(BigInt(raw));
  } catch {
    return 0;
  }
}

export async function resolveDisplayNames(
  addresses: string[]
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  const tasks = addresses.map((addr) => async () => {
    try {
      const name = await getDisplayName(addr);
      nameMap.set(addr, name || addr);
    } catch {
      nameMap.set(addr, addr);
    }
  });
  await batchAll(tasks, 5);
  return nameMap;
}

// ── Write functions ───────────────────────────────────────────────────────────

export async function createMarket(
  publicKey: string,
  question: string,
  imageUrl: string,
  category: MarketCategory,
  durationSecs: number,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  const result = await buildAndSendTx(
    publicKey,
    MARKET_CONTRACT_ID,
    "create_market",
    [
      addressVal(publicKey),
      stringVal(question),
      stringVal(imageUrl),
      categoryVal(category),
      u64Val(durationSecs),
    ],
    signTransaction
  );

  if (result.success) {
    cache.invalidate(CACHE_MARKETS);
  }
  return result;
}

export async function placeBet(
  publicKey: string,
  marketId: number,
  isYes: boolean,
  amount: number,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  const result = await buildAndSendTx(
    publicKey,
    MARKET_CONTRACT_ID,
    "place_bet",
    [
      addressVal(publicKey),
      u64Val(marketId),
      boolVal(isYes),
      i128Val(xlmToStroops(amount)),
    ],
    signTransaction
  );

  if (result.success) {
    cache.invalidate(CACHE_MARKETS);
    cache.invalidate(CACHE_MARKET(marketId));
    cache.invalidate(CACHE_BET(marketId, publicKey));
    cache.invalidate(CACHE_BETTORS(marketId));
    // Invalidate any XLM balance cache so BettingPanel shows updated balance
    cache.invalidate(`xlm_balance_${publicKey}`);
  }
  return result;
}

export async function resolveMarket(
  publicKey: string,
  marketId: number,
  outcome: boolean,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  const result = await buildAndSendTx(
    publicKey,
    MARKET_CONTRACT_ID,
    "resolve_market",
    [addressVal(publicKey), u64Val(marketId), boolVal(outcome)],
    signTransaction
  );

  if (result.success) {
    cache.invalidate(CACHE_MARKETS);
    cache.invalidate(CACHE_MARKET(marketId));
  }
  return result;
}

export async function cancelMarket(
  publicKey: string,
  marketId: number,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  const result = await buildAndSendTx(
    publicKey,
    MARKET_CONTRACT_ID,
    "cancel_market",
    [addressVal(publicKey), u64Val(marketId)],
    signTransaction
  );

  if (result.success) {
    cache.invalidate(CACHE_MARKETS);
    cache.invalidate(CACHE_MARKET(marketId));
    cache.invalidate(CACHE_BETTORS(marketId));
    cache.invalidate(CACHE_FEES);
  }
  return result;
}

/**
 * Pull a cancel refund for the connected user on a cancelled market.
 * This is the new O(1) per-user refund — replaces the old O(n) admin cancel flow.
 */
export async function cancelRefund(
  publicKey: string,
  marketId: number,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  const result = await buildAndSendTx(
    publicKey,
    MARKET_CONTRACT_ID,
    "cancel_refund",
    [addressVal(publicKey), u64Val(marketId)],
    signTransaction
  );

  if (result.success) {
    cache.invalidate(CACHE_MARKET(marketId));
    cache.invalidate(CACHE_BET(marketId, publicKey));
    cache.invalidate(`xlm_balance_${publicKey}`);
  }
  return result;
}

export async function claim(
  publicKey: string,
  marketId: number,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  const result = await buildAndSendTx(
    publicKey,
    MARKET_CONTRACT_ID,
    "claim",
    [addressVal(publicKey), u64Val(marketId)],
    signTransaction
  );

  if (result.success) {
    cache.invalidate(CACHE_BET(marketId, publicKey));
    cache.invalidate(CACHE_MARKET(marketId));
    cache.invalidate(CACHE_FEES);
    cache.invalidate(`xlm_balance_${publicKey}`);
  }
  return result;
}

export async function withdrawFees(
  callerPublicKey: string,
  recipientAddress: string,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  const result = await buildAndSendTx(
    callerPublicKey,
    MARKET_CONTRACT_ID,
    "withdraw_fees",
    [addressVal(callerPublicKey), addressVal(recipientAddress)],
    signTransaction
  );

  if (result.success) {
    cache.invalidate(CACHE_FEES);
  }
  return result;
}

export async function addResolver(
  adminPublicKey: string,
  resolverAddress: string,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  return buildAndSendTx(
    adminPublicKey,
    MARKET_CONTRACT_ID,
    "add_resolver",
    [addressVal(adminPublicKey), addressVal(resolverAddress)],
    signTransaction
  );
}

export async function removeResolver(
  adminPublicKey: string,
  resolverAddress: string,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  return buildAndSendTx(
    adminPublicKey,
    MARKET_CONTRACT_ID,
    "remove_resolver",
    [addressVal(adminPublicKey), addressVal(resolverAddress)],
    signTransaction
  );
}

export async function addFeeRecipient(
  adminPublicKey: string,
  recipientAddress: string,
  signTransaction: (txXdr: string) => Promise<string>
): Promise<TransactionResult> {
  return buildAndSendTx(
    adminPublicKey,
    MARKET_CONTRACT_ID,
    "add_fee_recipient",
    [addressVal(adminPublicKey), addressVal(recipientAddress)],
    signTransaction
  );
}
