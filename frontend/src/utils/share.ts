// ── Social Sharing URL Builders ───────────────────────────────────────────────

const BASE_URL = "https://stellarpulse.app";

/**
 * Build an X (Twitter) share intent URL.
 */
export function buildTwitterShareUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/**
 * Build a Telegram share URL.
 */
export function buildTelegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/**
 * Build a WhatsApp share URL.
 */
export function buildWhatsAppShareUrl(text: string, url: string): string {
  const combined = `${text} ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(combined)}`;
}

/**
 * Build the pre-filled share text for a bet.
 *
 * Example output:
 *   "I just bet 100 XLM that Will ETH flip BTC? on StellarPulse!
 *    Think I'm wrong? 👉 https://stellarpulse.app/markets/1?ref=GABC..."
 */
export function buildShareText(
  question: string,
  amount: number,
  side: "YES" | "NO",
  marketId: number,
  referralAddress?: string
): string {
  let marketUrl = `${BASE_URL}/markets/${marketId}`;
  if (referralAddress) {
    marketUrl += `?ref=${referralAddress}`;
  }

  return `I just bet ${amount} XLM ${side} on "${question}" on StellarPulse! Think I'm wrong? 👉 ${marketUrl}`;
}

/**
 * Get the market URL, optionally with referral param.
 */
export function getMarketUrl(
  marketId: number,
  referralAddress?: string
): string {
  let url = `${BASE_URL}/markets/${marketId}`;
  if (referralAddress) {
    url += `?ref=${referralAddress}`;
  }
  return url;
}
