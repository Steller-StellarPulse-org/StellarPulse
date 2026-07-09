// ── Network Configuration ─────────────────────────────────────────────────────
// Defaults to MAINNET. Override via environment variables for testnet dev work.
//
// Mainnet Soroban RPC options (both confirmed live, Protocol 26):
//   Primary:   https://mainnet.sorobanrpc.com  (community RPC, fast)
//   Fallback:  use the primary — SDF's own RPC is behind Cloudflare redirect
//
// To switch back to testnet for local dev:
//   NEXT_PUBLIC_NETWORK=testnet in your .env.local

const isTestnet = process.env.NEXT_PUBLIC_NETWORK === "testnet";

/**
 * Resolve the Soroban RPC URL the SDK talks to.
 *
 * In the BROWSER we route through our own same-origin proxy at `/api/rpc`
 * (see src/app/api/rpc/route.ts). That proxy:
 *   • keeps the real (paid) RPC URL server-side, off the public bundle,
 *   • only accepts requests from our own deployed origin,
 *   • collapses duplicate read bursts into one upstream call.
 *
 * On the SERVER (SSR / route handlers) and during build we hit the real RPC
 * directly — there's no `window`, and the proxy itself runs server-side.
 *
 * Set NEXT_PUBLIC_RPC_PROXY=off to bypass the proxy and talk to the RPC
 * directly from the browser (useful for local debugging).
 */
export function resolveSorobanUrl(): string {
  const direct =
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
    (isTestnet
      ? "https://soroban-testnet.stellar.org"
      : "https://mainnet.sorobanrpc.com");

  const proxyDisabled = process.env.NEXT_PUBLIC_RPC_PROXY === "off";
  const inBrowser = typeof window !== "undefined";

  if (inBrowser && !proxyDisabled) {
    // The Stellar SDK's rpc.Server does `new URL(...)` internally, which throws
    // on a relative path — so build an absolute same-origin URL.
    return `${window.location.origin}/api/rpc`;
  }
  return direct;
}

export const NETWORK = {
  name: isTestnet ? "testnet" : "mainnet",
  url: process.env.NEXT_PUBLIC_HORIZON_URL ||
    (isTestnet
      ? "https://horizon-testnet.stellar.org"
      : "https://horizon.stellar.org"),
  passphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
    (isTestnet
      ? "Test SDF Network ; September 2015"
      : "Public Global Stellar Network ; September 2015"),
  sorobanUrl: resolveSorobanUrl(),
  // Friendbot only exists on testnet — undefined on mainnet (not used)
  friendbotUrl: isTestnet
    ? (process.env.NEXT_PUBLIC_FRIENDBOT_URL || "https://friendbot.stellar.org")
    : undefined,
} as const;

// ── Contract IDs ──────────────────────────────────────────────────────────────
// Set via environment variables after deployment.
// These are EMPTY until you run deploy-mainnet.sh and paste the output IDs.

export const MARKET_CONTRACT_ID =
  process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID || "";

export const TOKEN_CONTRACT_ID =
  process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || "";

export const REFERRAL_CONTRACT_ID =
  process.env.NEXT_PUBLIC_REFERRAL_CONTRACT_ID || "";

export const LEADERBOARD_CONTRACT_ID =
  process.env.NEXT_PUBLIC_LEADERBOARD_CONTRACT_ID || "";

// IMPORTANT: the native XLM Stellar Asset Contract ID is DIFFERENT per network
// because it is derived from the network passphrase. Using the wrong one makes
// every transfer trap with "Storage, MissingValue". Defaults are network-aware.
//   Mainnet: CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA
//   Testnet: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
export const XLM_SAC_ID = process.env.NEXT_PUBLIC_XLM_SAC_ID ||
  (isTestnet
    ? "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
    : "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA");

// ── Admin ─────────────────────────────────────────────────────────────────────
// SECURITY: No hardcoded fallback admin key.
// Set NEXT_PUBLIC_ADMIN_PUBLIC_KEY in your deployment environment.
// Without it, admin-only UI (create market, resolve, withdraw fees) is hidden.

export const ADMIN_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_ADMIN_PUBLIC_KEY || "";

// ── Fee Sponsorship ───────────────────────────────────────────────────────────
// SECURITY WARNING: NEXT_PUBLIC_ vars are embedded in the JS bundle.
// On MAINNET: leave NEXT_PUBLIC_SPONSOR_SECRET_KEY blank.
//   → Users pay their own small gas fee (~0.01–0.05 XLM).
//   → Your sponsor account cannot be drained.
// On TESTNET only: you may set it for gasless UX testing.
//
// For mainnet gasless UX: implement a /api/sponsor server-side route instead.

export const SPONSOR_SECRET_KEY =
  process.env.NEXT_PUBLIC_SPONSOR_SECRET_KEY || "";

// ── Fee Model (basis points) ──────────────────────────────────────────────────
// 2% total: 1.5% platform (accumulated fees) + 0.5% referrer

export const TOTAL_FEE_BPS = 200;
export const PLATFORM_FEE_BPS = 150;
export const REFERRAL_FEE_BPS = 50;

// ── Reward Constants ──────────────────────────────────────────────────────────

export const REFERRAL_BET_POINTS = 3;
export const WIN_POINTS = 30;
export const LOSE_POINTS = 10;
export const WIN_TOKENS = 10;
export const LOSE_TOKENS = 2;
export const REGISTER_BONUS_POINTS = 5;
export const REGISTER_BONUS_TOKENS = 1;
