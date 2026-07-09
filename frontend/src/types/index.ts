// ── Market ────────────────────────────────────────────────────────────────────

export type MarketCategory =
  | "Crypto"
  | "Sports"
  | "Politics"
  | "Entertainment"
  | "Science"
  | "Other";

export const MARKET_CATEGORIES: MarketCategory[] = [
  "Crypto",
  "Sports",
  "Politics",
  "Entertainment",
  "Science",
  "Other",
];

export interface Market {
  id: number;
  question: string;
  imageUrl: string;
  category: MarketCategory;
  endTime: number;
  totalYes: number;
  totalNo: number;
  resolved: boolean;
  outcome: boolean;
  cancelled: boolean;
  creator: string;
  betCount: number;
}

// ── Bet ───────────────────────────────────────────────────────────────────────

export interface Bet {
  amount: number;
  isYes: boolean;
  claimed: boolean;
}

// ── Player Stats ──────────────────────────────────────────────────────────────

export interface PlayerStats {
  address: string;
  displayName: string;
  points: number;
  totalBets: number;
  wonBets: number;
  lostBets: number;
  winRate: number;
}

// ── Token Info ────────────────────────────────────────────────────────────────

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
}

// ── Referral Info ─────────────────────────────────────────────────────────────

export interface ReferralInfo {
  referrer: string | null;
  displayName: string;
  referralCount: number;
  earnings: number;
  isRegistered: boolean;
}

// ── Filters & Sorting ────────────────────────────────────────────────────────

export type MarketFilter =
  | "all"
  | "active"
  | "ending_soon"
  | "ended"
  | "resolved"
  | "cancelled"
  | "crypto"
  | "sports"
  | "politics"
  | "entertainment"
  | "science";

export type MarketSort = "newest" | "volume" | "ending_soon" | "bettors";

// ── Transaction Result ───────────────────────────────────────────────────────

export interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export enum AppErrorType {
  NETWORK = "NETWORK",
  WALLET = "WALLET",
  CONTRACT = "CONTRACT",
  VALIDATION = "VALIDATION",
  SIMULATION = "SIMULATION",
  TIMEOUT = "TIMEOUT",
}

export interface AppError {
  type: AppErrorType;
  message: string;
  details?: string;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export type WalletType = "freighter" | "albedo" | "xbull";

// ── Events ────────────────────────────────────────────────────────────────────

export interface MarketEvent {
  type:
    | "bet_placed"
    | "market_resolved"
    | "market_cancelled"
    | "reward_claimed"
    | "fees_withdrawn";
  user: string;
  marketId: number;
  amount?: number;
  timestamp: number;
  txHash: string;
}
