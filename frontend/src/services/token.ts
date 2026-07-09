import { Address } from "@stellar/stellar-sdk";
import { TOKEN_CONTRACT_ID } from "@/config/network";
import { simulateTransaction , getSimulationSource } from "@/services/soroban";
import * as cache from "@/services/cache";
import type { TokenInfo } from "@/types";

// ── Cache keys & TTLs ────────────────────────────────────────────────────────

const CACHE_BALANCE = (addr: string) => `token_bal_${addr}`;
const CACHE_TOKEN_INFO = "token_info";
const CACHE_TOTAL_SUPPLY = "token_supply";

const TOKEN_TTL = 30_000; // 30s
const INFO_TTL = 300_000; // 5 min — metadata rarely changes

/** Simulation source — any valid key works for reads */


/** Fetch PULSE token balance for an account (in human-readable units) */
export async function getBalance(account: string): Promise<number> {
  const cacheKey = CACHE_BALANCE(account);
  const cached = cache.get<number>(cacheKey);
  if (cached !== null) return cached;

  try {
    const raw = await simulateTransaction<number | bigint>(
      getSimulationSource(),
      TOKEN_CONTRACT_ID,
      "balance",
      [new Address(account).toScVal()]
    );
    // Token has 7 decimals — convert from smallest unit to human-readable
    const balance = Number(raw) / 1e7;
    cache.set(cacheKey, balance, TOKEN_TTL);
    return balance;
  } catch {
    return 0;
  }
}

/** Fetch token metadata (name, symbol, decimals, totalSupply) */
export async function getTokenInfo(): Promise<TokenInfo> {
  const cached = cache.get<TokenInfo>(CACHE_TOKEN_INFO);
  if (cached) return cached;

  try {
    const src = getSimulationSource();
    const cid = TOKEN_CONTRACT_ID;

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      simulateTransaction<string>(src, cid, "name", []),
      simulateTransaction<string>(src, cid, "symbol", []),
      simulateTransaction<number | bigint>(src, cid, "decimals", []),
      simulateTransaction<number | bigint>(src, cid, "total_supply", []),
    ]);

    const info: TokenInfo = {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: Number(totalSupply),
    };
    cache.set(CACHE_TOKEN_INFO, info, INFO_TTL);
    return info;
  } catch {
    // Return defaults if contract not yet deployed
    return { name: "PULSE", symbol: "PLSE", decimals: 7, totalSupply: 0 };
  }
}

/** Fetch total supply */
export async function getTotalSupply(): Promise<number> {
  const cached = cache.get<number>(CACHE_TOTAL_SUPPLY);
  if (cached !== null) return cached;

  try {
    const raw = await simulateTransaction<number | bigint>(
      getSimulationSource(),
      TOKEN_CONTRACT_ID,
      "total_supply",
      []
    );
    const supply = Number(raw);
    cache.set(CACHE_TOTAL_SUPPLY, supply, TOKEN_TTL);
    return supply;
  } catch {
    return 0;
  }
}
