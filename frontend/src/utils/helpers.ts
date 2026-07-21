const STROOPS_PER_XLM = 10_000_000n;
const DASH = "—";

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

export function displayXLM(xlm: number): string {
  if (xlm === 0) return "0 XLM";
  const formatted = xlm.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} XLM`;
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function isValidAmount(amount: string, balance: number): boolean {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed < 1) return false;
  return parsed <= balance;
}

/**
 * Return a human-readable "time until" string from a Unix timestamp (seconds).
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

  return `${diff}s`;
}

/**
 * Format a Unix timestamp (seconds) to a locale-aware date/time string.
 *
 * Uses the viewer's browser locale and local timezone automatically — no
 * hardcoded "en-US" or UTC offset. Timestamps are treated as Unix seconds
 * and converted to milliseconds before constructing the Date.
 *
 * Example (en-GB, Europe/London): "12 Jul 2026, 14:30"
 * Example (en-US, America/New_York): "Jul 12, 2026, 10:30 AM"
 */
export function formatDate(timestamp: number): string {
  // Soroban ledger timestamps are Unix seconds. Guard against accidental
  // millisecond values (> year 2100 in seconds ≈ 4_102_444_800).
  const ms = timestamp > 4_102_444_800 ? timestamp : timestamp * 1000;

  return new Date(ms).toLocaleString(undefined, {
function isValidTimestamp(timestamp: number): boolean {
  return Number.isFinite(timestamp) && timestamp > 0;
}
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Return a human-readable relative time string from a Unix timestamp (seconds).
 * Automatically uses the viewer's locale via Intl.RelativeTimeFormat.
 *
 * Examples: "2 hours ago", "3 days ago", "just now"
 */
export function timeAgo(timestamp: number): string {
  // Same millisecond guard as formatDate
  const ms = timestamp > 4_102_444_800 ? timestamp : timestamp * 1000;
  const diffSeconds = Math.floor((Date.now() - ms) / 1000);

  if (diffSeconds < 5) return "just now";

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  const thresholds: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3_600, "minute"],
    [86_400, "hour"],
    [604_800, "day"],
    [2_592_000, "week"],
    [31_536_000, "month"],
  ];

  for (const [limit, unit] of thresholds) {
    if (diffSeconds < limit) {
      const prev = thresholds[thresholds.indexOf([limit, unit]) - 1];
      const divisor = prev ? prev[0] : 1;
      return rtf.format(-Math.floor(diffSeconds / divisor), unit);
    }
  }

  return rtf.format(-Math.floor(diffSeconds / 31_536_000), "year");
}

/**
 * Calculate a winner's payout from a prediction market.
 *
 * payout = (userNetBet / winningSideTotal) × totalPool
 *
 * All values in XLM (not stroops).
 * Format a Unix timestamp to a viewer-locale time string.
 */
export function formatTime(timestamp: number): string {
  return new Date(timestampToMilliseconds(timestamp)).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  });
}

export function formatDate(
  timestamp: number,
  locale?: Intl.LocalesArgument,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return formatTimestamp(timestamp, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  });
}

export function formatTime(
  timestamp: number,
  locale?: Intl.LocalesArgument,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return formatTimestamp(timestamp, locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  });
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
 * Returns { yesPercent, noPercent } – each 0-100.
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

export function explorerUrl(
  type: "tx" | "account" | "contract",
  id: string,
  network: "public" | "testnet" = "public"
): string {
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
