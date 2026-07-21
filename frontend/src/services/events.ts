import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { MARKET_CONTRACT_ID } from "@/config/network";
import { getSorobanServer } from "@/services/soroban";
import type { MarketEvent } from "@/types";

// ── Event type names emitted by the PredictionMarket contract ─────────────────

const EVENT_TYPES = [
  "bet_placed",
  "market_resolved",
  "market_cancelled",
  "reward_claimed",
  "fees_withdrawn",
] as const;

type ContractEventType = (typeof EVENT_TYPES)[number];

function isKnownEventType(s: string): s is ContractEventType {
  return (EVENT_TYPES as readonly string[]).includes(s);
}

const MILLISECOND_TIMESTAMP_THRESHOLD = 100_000_000_000;
const ISO_TIMESTAMP_WITH_TIME_ZONE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:[zZ]|[+-](\d{2}):(\d{2}))$/;

/** Normalize an RPC ledger close time to the app's Unix-seconds contract. */
export function ledgerClosedAtToUnixSeconds(
  ledgerClosedAt: string | number | Date
): number {
  let timestampSeconds: number;

  if (typeof ledgerClosedAt === "number") {
    timestampSeconds =
      Math.abs(ledgerClosedAt) >= MILLISECOND_TIMESTAMP_THRESHOLD
        ? ledgerClosedAt / 1000
        : ledgerClosedAt;
  } else if (ledgerClosedAt instanceof Date) {
    timestampSeconds = ledgerClosedAt.getTime() / 1000;
  } else {
    const timestampText = ledgerClosedAt.trim();
    const match = ISO_TIMESTAMP_WITH_TIME_ZONE.exec(timestampText);
    if (!match) throw new RangeError("Invalid ledger close timestamp");

    const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
      match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const offsetHour = Number(match[7] ?? 0);
    const offsetMinute = Number(match[8] ?? 0);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [
      31,
      leapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth[month - 1] ||
      hour > 23 ||
      minute > 59 ||
      second > 59 ||
      offsetHour > 23 ||
      offsetMinute > 59
    ) {
      throw new RangeError("Invalid ledger close timestamp");
    }

    timestampSeconds = Date.parse(timestampText) / 1000;
  }

  if (!Number.isFinite(timestampSeconds)) {
    throw new RangeError("Invalid ledger close timestamp");
  }

  return Math.floor(timestampSeconds);
}

// ── Parse a single event response into MarketEvent ────────────────────────────

function parseEventResponse(
  event: rpc.Api.EventResponse
): MarketEvent | null {
  try {
    // Topics: [event_name, ...params]
    const topics = event.topic.map((t: xdr.ScVal) => scValToNative(t));
    const eventName = String(topics[0]);

    if (!isKnownEventType(eventName)) return null;

    const data = scValToNative(event.value);
    const timestamp = ledgerClosedAtToUnixSeconds(event.ledgerClosedAt);

    switch (eventName) {
      case "bet_placed":
        return {
          type: "bet_placed",
          marketId: Number(topics[1] ?? data?.market_id ?? 0),
          user: String(topics[2] ?? data?.user ?? ""),
          amount: Number(data?.amount ?? data?.net_amount ?? 0),
          timestamp,
          txHash: event.txHash,
        };

      case "market_resolved":
        return {
          type: "market_resolved",
          marketId: Number(topics[1] ?? data?.market_id ?? 0),
          user: "", // resolved by admin, no specific user
          timestamp,
          txHash: event.txHash,
        };

      case "market_cancelled":
        return {
          type: "market_cancelled",
          marketId: Number(topics[1] ?? data?.market_id ?? 0),
          user: "",
          timestamp,
          txHash: event.txHash,
        };

      case "reward_claimed":
        return {
          type: "reward_claimed",
          marketId: Number(topics[1] ?? data?.market_id ?? 0),
          user: String(topics[2] ?? data?.user ?? ""),
          amount: Number(data?.payout_xlm ?? data?.payout ?? 0),
          timestamp,
          txHash: event.txHash,
        };

      case "fees_withdrawn":
        return {
          type: "fees_withdrawn",
          marketId: 0,
          user: String(topics[1] ?? data?.admin ?? ""),
          amount: Number(data?.amount ?? 0),
          timestamp,
          txHash: event.txHash,
        };

      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Poll for market events starting from a given ledger sequence.
 * Parses bet_placed, market_resolved, reward_claimed, market_cancelled,
 * and fees_withdrawn events from the PredictionMarket contract.
 *
 * @param startLedger — Ledger sequence to start from. If omitted, fetches
 *   from ~5 minutes ago (approx 60 ledgers back at 5s/ledger).
 * @returns Array of parsed MarketEvent objects, newest first.
 */
export async function pollMarketEvents(
  startLedger?: number
): Promise<MarketEvent[]> {
  const server = getSorobanServer();

  try {
    // Default to ~60 ledgers back if no start specified
    let ledger = startLedger;
    if (!ledger) {
      const latest = await server.getLatestLedger();
      ledger = Math.max(latest.sequence - 60, 1);
    }

    const response = await server.getEvents({
      startLedger: ledger,
      filters: [
        {
          type: "contract",
          contractIds: [MARKET_CONTRACT_ID],
          topics: [["*"]], // match all topics from this contract
        },
      ],
      limit: 100,
    });

    const events: MarketEvent[] = [];
    for (const raw of response.events) {
      const parsed = parseEventResponse(raw);
      if (parsed) events.push(parsed);
    }

    // Return newest first
    return events.reverse();
  } catch {
    return [];
  }
}
