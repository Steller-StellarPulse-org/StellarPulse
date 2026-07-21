import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { MARKET_CONTRACT_ID } from "@/config/network";
import { getSorobanServer } from "@/services/soroban";
import type { MarketEvent } from "@/types";

const EVENT_TYPES = [
  "bet_placed",
  "market_resolved",
  "market_cancelled",
  "reward_claimed",
  "fees_withdrawn",
] as const;
const MILLISECOND_TIMESTAMP_THRESHOLD = 100_000_000_000;
const ISO_TIMESTAMP_WITH_TIMEZONE =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

type ContractEventType = (typeof EVENT_TYPES)[number];

function isKnownEventType(value: string): value is ContractEventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

function assertValidIsoTimestamp(value: string): void {
  const match = ISO_TIMESTAMP_WITH_TIMEZONE.exec(value);
  if (!match) throw new RangeError("Invalid ledger close timestamp");

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, , zone] =
    match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new RangeError("Invalid ledger close timestamp");
  }

  if (zone !== "Z") {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) {
      throw new RangeError("Invalid ledger close timestamp");
    }
  }
}

/** Normalize Stellar ledger-close values to the app's Unix-seconds contract. */
export function ledgerClosedAtToUnixSeconds(
  ledgerClosedAt: string | number | Date
): number {
  let timestampMs: number;

  if (typeof ledgerClosedAt === "number") {
    if (!Number.isFinite(ledgerClosedAt) || ledgerClosedAt <= 0) {
      throw new RangeError("Invalid ledger close timestamp");
    }
    timestampMs =
      Math.abs(ledgerClosedAt) < MILLISECOND_TIMESTAMP_THRESHOLD
        ? ledgerClosedAt * 1_000
        : ledgerClosedAt;
  } else if (ledgerClosedAt instanceof Date) {
    timestampMs = ledgerClosedAt.getTime();
  } else if (typeof ledgerClosedAt === "string") {
    const value = ledgerClosedAt.trim();
    assertValidIsoTimestamp(value);
    timestampMs = Date.parse(value);
  } else {
    throw new RangeError("Invalid ledger close timestamp");
  }

  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    throw new RangeError("Invalid ledger close timestamp");
  }

  return Math.floor(timestampMs / 1_000);
}

function parseEventResponse(event: rpc.Api.EventResponse): MarketEvent | null {
  try {
    const topics = event.topic.map((topic: xdr.ScVal) => scValToNative(topic));
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
          user: "",
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

/** Poll market events and return the newest valid entries first. */
export async function pollMarketEvents(startLedger?: number): Promise<MarketEvent[]> {
  const server = getSorobanServer();

  try {
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
          topics: [["*"]],
        },
      ],
      limit: 100,
    });

    const events: MarketEvent[] = [];
    for (const raw of response.events) {
      const parsed = parseEventResponse(raw);
      if (parsed) events.push(parsed);
    }
    return events.reverse();
  } catch {
    return [];
  }
}
