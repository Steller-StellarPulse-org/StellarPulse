// ── Pure Utility Functions ───────────────────────────────────────────────────

const STROOPS_PER_XLM = 10_000_000n;
const MILLISECOND_TIMESTAMP_THRESHOLD = 100_000_000_000;
const INVALID_TIMESTAMP = "—";

/** Convert stroops (bigint) to a human-readable XLM string. */
export function formatXLM(stroops: bigint): string {
  const isNegative = stroops < 0n;
  const abs = isNegative ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const fractional = abs % STROOPS_PER_XLM;
  const fracStr = fractional.toString().padStart(7, "0").replace(/0+$/, "");
  const sign = isNegative ? "-" : "";

  return fracStr.length === 0
    ? `${sign}${whole} XLM`
    : `${sign}${whole}.${fracStr} XLM`;
}

/** Format a number that is already expressed in XLM. */
export function displayXLM(xlm: number): string {
  if (xlm === 0) return "0 XLM";
  const formatted = xlm.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} XLM`;
}

/** Truncate a Stellar address for display. */
export function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

/** Validate a bet amount against the minimum and the user's balance. */
export function isValidAmount(amount: string, balance: number): boolean {
  const parsed = parseFloat(amount);
  if (Number.isNaN(parsed) || parsed < 1) return false;
  return parsed <= balance;
}

/** Return a human-readable duration until a Unix-seconds timestamp. */
export function timeUntil(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86_400);
  const hours = Math.floor((diff % 86_400) / 3_600);
  const minutes = Math.floor((diff % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${diff}s`;
}

/** Normalize a positive Unix timestamp supplied in seconds or milliseconds. */
export function toTimestampMs(timestamp: number): number {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return Number.NaN;
  return Math.abs(timestamp) < MILLISECOND_TIMESTAMP_THRESHOLD
    ? timestamp * 1_000
    : timestamp;
}

/** Format a timestamp in the viewer's timezone, including its timezone label. */
export function formatDate(
  timestamp: number,
  locale?: Intl.LocalesArgument,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const timestampMs = toTimestampMs(timestamp);
  if (!Number.isFinite(timestampMs)) return INVALID_TIMESTAMP;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  }).format(new Date(timestampMs));
}

/** Format only the local time portion of a timestamp, with its timezone label. */
export function formatTime(
  timestamp: number,
  locale?: Intl.LocalesArgument,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const timestampMs = toTimestampMs(timestamp);
  if (!Number.isFinite(timestampMs)) return INVALID_TIMESTAMP;

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  }).format(new Date(timestampMs));
}

/** Format a timestamp relative to now while accepting seconds or milliseconds. */
export function timeAgo(
  timestamp: number,
  locale?: Intl.LocalesArgument
): string {
  const timestampMs = toTimestampMs(timestamp);
  if (!Number.isFinite(timestampMs)) return INVALID_TIMESTAMP;

  const diffSeconds = (timestampMs - Date.now()) / 1_000;
  const absoluteSeconds = Math.abs(diffSeconds);
  if (absoluteSeconds < 5) return "just now";

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  const [unit, unitSeconds] =
    units.find(([, seconds]) => absoluteSeconds >= seconds) ?? units[6];

  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(diffSeconds / unitSeconds),
    unit
  );
}

/** Calculate a winner's payout from a prediction market. */
export function calculatePayout(
  userNetBet: number,
  winningSideTotal: number,
  totalPool: number
): number {
  if (winningSideTotal <= 0) return 0;
  return (userNetBet / winningSideTotal) * totalPool;
}

/** Calculate YES/NO odds percentages from net totals. */
export function calculateOdds(
  totalYes: number,
  totalNo: number
): { yesPercent: number; noPercent: number } {
  const total = totalYes + totalNo;
  if (total <= 0) return { yesPercent: 50, noPercent: 50 };

  const yesPercent = Math.round((totalYes / total) * 100);
  return { yesPercent, noPercent: 100 - yesPercent };
}

/** Convert basis points to a percentage string. */
export function bpsToPercent(bps: number): string {
  return `${bps / 100}%`;
}

/** Build a Stellar Expert explorer URL. */
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
      return base;
  }
}
