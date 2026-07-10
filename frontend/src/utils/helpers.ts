// ── Pure Utility Functions ────────────────────────────────────────────────────

const STROOPS_PER_XLM = 10_000_000n;

/**
 * Convert stroops (bigint) to human-readable XLM string.
 * Example: 1234567890n → "123.456789 XLM"
 */
export function formatXLM(stroops: bigint): string {
  const isNegative = stroops < 0n;
  const abs = isNegative ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const fractional = abs % STROOPS_PER_XLM;
  const fracStr = fractional.toString().padStart(7, "0").replace(/0+$/, "");
  const sign = isNegative ? "-" : "";

  if (fracStr.length === 0) {
    return `${sign}${whole} XLM`;
  }
  return `${sign}${whole}.${fracStr} XLM`;
}

/**
 * Format a number (already in XLM units) to a display string.
 * Example: 12.5 → "12.50 XLM", 0 → "0 XLM"
 */
export function displayXLM(xlm: number): string {
  if (xlm === 0) return "0 XLM";
  // Show up to 2 decimal places, trim trailing zeros
  const formatted = xlm.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} XLM`;
}

/**
 * Truncate a Stellar address for display.
 * Example: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567" → "GABC...4567"
 */
export function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

/**
 * Validate a bet amount string against constraints.
 * - Must be a valid positive number
 * - Must be >= 1 (XLM minimum)
 * - Must not exceed the user's balance
 */
export function isValidAmount(amount: string, balance: number): boolean {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed < 1) return false;
  return parsed <= balance;
}

/**
 * Return a human-readable "time until" string from a Unix timestamp.
 * Example: timestamp 2 days from now → "2d 14h 32m"
 */
export function timeUntil(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;

  const seconds = diff;
  return `${seconds}s`;
}

/**
 * Format a Unix timestamp to a locale-aware date string.
 */
export function formatDate(
  timestamp: number,
  locale?: string | string[],
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  }).format(new Date(timestamp * 1000));
}

/**
 * Format a Unix timestamp to a locale-aware time string.
 */
export function formatTime(
  timestamp: number,
  locale?: string | string[],
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  }).format(new Date(timestamp * 1000));
}

/**
 * Calculate a winner's payout from a prediction market.
 *
 * payout = (userNetBet / winningSideTotal) × totalPool
 *
 * All values in XLM (not stroops).
 */
export function calculatePayout(
  userNetBet: number,
  winningSideTotal: number,
  totalPool: number
): number {
  if (winningSideTotal <= 0) return 0;
  return (userNetBet / winningSideTotal) * totalPool;
}

/**
 * Calculate YES/NO odds percentages from net totals.
 * Returns { yesPercent, noPercent } — each 0-100.
 */
export function calculateOdds(
  totalYes: number,
  totalNo: number
): { yesPercent: number; noPercent: number } {
  const total = totalYes + totalNo;
  if (total <= 0) return { yesPercent: 50, noPercent: 50 };

  const yesPercent = Math.round((totalYes / total) * 100);
  return { yesPercent, noPercent: 100 - yesPercent };
}

/**
 * Convert basis points to a percentage string.
 * Example: 200 → "2%", 150 → "1.5%"
 */
export function bpsToPercent(bps: number): string {
  const pct = bps / 100;
  return pct % 1 === 0 ? `${pct}%` : `${pct}%`;
}

/**
 * Build a Stellar Expert explorer URL.
 * Defaults to "public" (mainnet). Pass "testnet" for testnet links.
 */
export function explorerUrl(
  type: "tx" | "account" | "contract",
  id: string,
  network: "public" | "testnet" = "public"
): string {
  const base = `https://stellar.expert/explorer/${network}`;
  switch (type) {
    case "tx":
      return `${base}/tx/${id}`;
    case "account":
      return `${base}/account/${id}`;
    case "contract":
      return `${base}/contract/${id}`;
    default:
      return `${base}`;
  }
}
