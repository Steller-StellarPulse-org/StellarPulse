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

interface TimestampFormatOptions extends Intl.DateTimeFormatOptions {
  locale?: string;
}

function isValidUnixTimestamp(timestamp: number): boolean {
  return Number.isFinite(timestamp) && timestamp > 0;
}

/**
 * Format a Unix timestamp using the user's locale and timezone.
 */
export function formatDate(
  timestamp: number,
  localeOrOptions?: string | TimestampFormatOptions,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!isValidUnixTimestamp(timestamp)) return "—";

  const { locale, formatOptions } =
    typeof localeOrOptions === "string"
      ? { locale: localeOrOptions, formatOptions: options }
      : {
          locale: localeOrOptions?.locale,
          formatOptions: localeOrOptions ?? options,
        };

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...formatOptions,
  }).format(new Date(timestamp * 1000));
}

/**
 * Format a time from a Unix timestamp using the user's locale.
 */
export function formatTime(
  timestamp: number,
  locale?: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!isValidUnixTimestamp(timestamp)) return "—";

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  }).format(new Date(timestamp * 1000));
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
  yesTotal: number,
  noTotal: number
): { yesPercent: number; noPercent: number } {
  const total = yesTotal + noTotal;
  if (total === 0) return { yesPercent: 50, noPercent: 50 };
  const yesPercent = Math.round((yesTotal / total) * 100);
  return { yesPercent, noPercent: 100 - yesPercent };
}

/**
 * Convert basis points to a percentage string.
 */
export function bpsToPercent(bps: number): string {
  const percent = bps / 100;
  return `${percent}`.replace(/\.0$/, "") + "%";
}

/**
 * Build a Stellar Expert explorer URL.
 */
export function explorerUrl(
  type: "tx" | "account" | "contract",
  id: string,
  network: "public" | "testnet" = "public"
): string {
  return `https://stellar.expert/explorer/${network}/${type}/${id}`;
}

/**
 * Format a millisecond timestamp using the shared date formatter.
 */
export function formatEventTime(
  timestampMs: number,
  localeOrOptions?: string | TimestampFormatOptions,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return "—";
  return formatDate(Math.floor(timestampMs / 1000), localeOrOptions, options);
}

/**
 * Return a compact relative time label for a past Unix timestamp.
 */
export function timeAgo(timestamp: number): string {
  if (!isValidUnixTimestamp(timestamp)) return "—";

  const diff = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (diff < 5) return "just now";

  const minutes = Math.floor(diff / 60);
  if (minutes < 1) return `${diff}s ago`;
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
