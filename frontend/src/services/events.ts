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
    const timestamp = new Date(event.ledgerClosedAt).getTime();

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
