const STROOPS_PER_XLM = 10_000_000n;
const DASH = "—";
const SECONDS_MS_THRESHOLD = 4_102_444_800;

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

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

export function toTimestampMs(timestamp: number): number {
  return timestamp > SECONDS_MS_THRESHOLD ? timestamp : timestamp * 1000;
}

function isValidTimestamp(timestamp: number): boolean {
  return Number.isFinite(timestamp) && timestamp > 0;
}

function withFormatOptions(
  base: Intl.DateTimeFormatOptions,
  optionsOrTimeZone?: Intl.DateTimeFormatOptions | string,
  includeTimeZoneName = true
): Intl.DateTimeFormatOptions {
  if (typeof optionsOrTimeZone === "string") {
    return { ...base, timeZone: optionsOrTimeZone };
  }

  return {
    ...base,
    ...(includeTimeZoneName ? { timeZoneName: "short" as const } : {}),
    ...optionsOrTimeZone,
  };
}

export function formatDate(
  timestamp: number,
  locale?: Intl.LocalesArgument,
  optionsOrTimeZone?: Intl.DateTimeFormatOptions | string
): string {
  if (!isValidTimestamp(timestamp)) return DASH;
  return new Date(toTimestampMs(timestamp)).toLocaleString(
    locale,
    withFormatOptions(
      DATE_TIME_OPTIONS,
      optionsOrTimeZone,
      typeof optionsOrTimeZone !== "string"
    )
  );
}

export function formatDateTime(
  timestamp: number,
  locale?: Intl.LocalesArgument,
  optionsOrTimeZone?: Intl.DateTimeFormatOptions | string
): string {
  return formatDate(timestamp, locale, optionsOrTimeZone);
}

export function formatTime(
  timestamp: number,
  locale?: Intl.LocalesArgument,
  optionsOrTimeZone?: Intl.DateTimeFormatOptions | string
): string {
  if (!isValidTimestamp(timestamp)) return DASH;
  return new Date(toTimestampMs(timestamp)).toLocaleTimeString(
    locale,
    withFormatOptions(
      TIME_OPTIONS,
      optionsOrTimeZone,
      typeof optionsOrTimeZone !== "string"
    )
  );
}

export function formatEventTime(
  timestampMs: number,
  locale?: Intl.LocalesArgument,
  optionsOrTimeZone?: Intl.DateTimeFormatOptions | string
): string {
  if (!isValidTimestamp(timestampMs)) return DASH;
  return formatDate(timestampMs, locale, optionsOrTimeZone);
}

export function calculatePayout(
  userNetBet: number,
  winningSideTotal: number,
  totalPool: number
): number {
  if (winningSideTotal <= 0) return 0;
  return (userNetBet / winningSideTotal) * totalPool;
}

export function calculateOdds(
  yesTotal: number,
  noTotal: number
): { yesPercent: number; noPercent: number } {
  const total = yesTotal + noTotal;
  if (total === 0) return { yesPercent: 50, noPercent: 50 };
  const yesPercent = Math.round((yesTotal / total) * 100);
  return { yesPercent, noPercent: 100 - yesPercent };
}

export function bpsToPercent(bps: number): string {
  const percent = bps / 100;
  return `${percent}`.replace(/\.0$/, "") + "%";
}

export function explorerUrl(
  type: "tx" | "account" | "contract",
  id: string,
  network: "public" | "testnet" = "public"
): string {
  return `https://stellar.expert/explorer/${network}/${type}/${id}`;
}

export function timeAgo(timestamp: number): string {
  if (!isValidTimestamp(timestamp)) return DASH;

  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - toTimestampMs(timestamp)) / 1000)
  );
  if (diffSeconds < 5) return "just now";

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const intervals: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secondsInUnit] of intervals) {
    if (diffSeconds >= secondsInUnit || unit === "second") {
      return rtf.format(-Math.floor(diffSeconds / secondsInUnit), unit);
    }
  }

  return rtf.format(0, "second");
}
