import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSimulateTransaction = vi.fn();
const mockBuildAndSendTx = vi.fn();

vi.mock("@/services/soroban", () => ({
  simulateTransaction: (...args: unknown[]) => mockSimulateTransaction(...args),
  buildAndSendTx: (...args: unknown[]) => mockBuildAndSendTx(...args),
  getSimulationSource: () => "GADMIN456",
  setSimulationSource: vi.fn(),
}));

vi.mock("@/services/cache", () => ({
  get: () => null,
  set: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
}));

vi.mock("@/services/referral", () => ({
  getDisplayName: vi.fn().mockResolvedValue(""),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Address: class {
    _addr: string;
    constructor(addr: string) {
      this._addr = addr;
    }
    toScVal() {
      return { type: "address", value: this._addr };
    }
  },
  nativeToScVal: (val: unknown, opts: { type: string }) => ({
    type: opts.type,
    value: val,
  }),
  xdr: {
    ScVal: {
      scvVec: (v: unknown) => ({ type: "vec", value: v }),
      scvSymbol: (s: string) => ({ type: "symbol", value: s }),
    },
  },
}));

vi.mock("@/config/network", () => ({
  MARKET_CONTRACT_ID: "CMARKET123",
  ADMIN_PUBLIC_KEY: "GADMIN456",
  TOTAL_FEE_BPS: 200,
  PLATFORM_FEE_BPS: 150,
  REFERRAL_FEE_BPS: 50,
}));

import {
  getMarket,
  getMarkets,
  getBet,
  placeBet,
  resolveMarket,
  claim,
  cancelRefund,
} from "@/services/market";

// ── Tests ──────────────────────────────────────────────────────────────────

// 1 XLM = 10_000_000 stroops
const ONE_XLM = 10_000_000n;

describe("market service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMarket", () => {
    it("returns parsed Market object on success with correct XLM conversion", async () => {
      // 1000 XLM YES, 500 XLM NO in stroops
      mockSimulateTransaction.mockResolvedValueOnce({
        id: 1n,
        question: "Will ETH flip BTC?",
        image_url: "/eth.png",
        category: "Crypto",
        end_time: 1700000000n,
        total_yes: 1000n * ONE_XLM, // 1000 XLM in stroops
        total_no: 500n * ONE_XLM,   // 500 XLM in stroops
        resolved: false,
        outcome: false,
        cancelled: false,
        creator: "GCREATOR",
        bet_count: 5n,
      });

      const market = await getMarket(1);
      expect(market).not.toBeNull();
      expect(market!.id).toBe(1);
      expect(market!.question).toBe("Will ETH flip BTC?");
      // totalYes and totalNo are in XLM (human-readable)
      expect(market!.totalYes).toBe(1000);
      expect(market!.totalNo).toBe(500);
      expect(market!.betCount).toBe(5);
      expect(market!.category).toBe("Crypto");
    });

    it("returns null on error", async () => {
      mockSimulateTransaction.mockRejectedValueOnce(new Error("not found"));
      const market = await getMarket(999);
      expect(market).toBeNull();
    });
  });

  describe("getMarkets", () => {
    it("returns array of markets", async () => {
      // First call: get_market_count => 2
      mockSimulateTransaction.mockResolvedValueOnce(2n);
      // Then two get_market calls
      mockSimulateTransaction
        .mockResolvedValueOnce({
          id: 1n,
          question: "Q1",
          image_url: "",
          category: "Sports",
          end_time: 100n,
          total_yes: 10n * ONE_XLM,
          total_no: 5n * ONE_XLM,
          resolved: false,
          outcome: false,
          cancelled: false,
          creator: "G1",
          bet_count: 2n,
        })
        .mockResolvedValueOnce({
          id: 2n,
          question: "Q2",
          image_url: "",
          category: "Crypto",
          end_time: 200n,
          total_yes: 20n * ONE_XLM,
          total_no: 15n * ONE_XLM,
          resolved: false,
          outcome: false,
          cancelled: false,
          creator: "G2",
          bet_count: 4n,
        });

      const markets = await getMarkets();
      expect(markets).toHaveLength(2);
      expect(markets[0].question).toBe("Q1");
      expect(markets[0].totalYes).toBe(10);
      expect(markets[1].question).toBe("Q2");
      expect(markets[1].totalNo).toBe(15);
    });

    it("returns empty array when count is 0", async () => {
      mockSimulateTransaction.mockResolvedValueOnce(0n);
      const markets = await getMarkets();
      expect(markets).toEqual([]);
    });

    it("returns empty array when get_market_count throws", async () => {
      mockSimulateTransaction.mockRejectedValueOnce(new Error("RPC down"));
      const markets = await getMarkets();
      expect(markets).toEqual([]);
    });

    it("skips individual bad markets and returns the rest", async () => {
      mockSimulateTransaction.mockResolvedValueOnce(2n); // count = 2
      mockSimulateTransaction
        .mockRejectedValueOnce(new Error("market 1 broken")) // market 1 fails
        .mockResolvedValueOnce({
          id: 2n,
          question: "Q2",
          image_url: "",
          category: "Crypto",
          end_time: 200n,
          total_yes: 20n * ONE_XLM,
          total_no: 15n * ONE_XLM,
          resolved: false,
          outcome: false,
          cancelled: false,
          creator: "G2",
          bet_count: 4n,
        });

      const markets = await getMarkets();
      expect(markets).toHaveLength(1);
      expect(markets[0].question).toBe("Q2");
    });
  });

  describe("getBet", () => {
    it("returns parsed Bet on success with correct XLM conversion", async () => {
      mockSimulateTransaction.mockResolvedValueOnce({
        amount: 98n * ONE_XLM, // 98 XLM net
        is_yes: true,
        claimed: false,
      });

      const bet = await getBet(1, "GUSER");
      expect(bet).not.toBeNull();
      expect(bet!.amount).toBe(98);   // 98 XLM
      expect(bet!.isYes).toBe(true);
      expect(bet!.claimed).toBe(false);
    });

    it("returns null on error", async () => {
      mockSimulateTransaction.mockRejectedValueOnce(new Error("no bet"));
      const bet = await getBet(1, "GUSER");
      expect(bet).toBeNull();
    });
  });

  describe("placeBet", () => {
    it("calls buildAndSendTx with correct method", async () => {
      const mockSign = vi.fn();
      mockBuildAndSendTx.mockResolvedValueOnce({
        success: true,
        hash: "abc123",
      });

      const result = await placeBet("GUSER", 1, true, 100, mockSign);
      expect(result.success).toBe(true);
      expect(result.hash).toBe("abc123");
      expect(mockBuildAndSendTx).toHaveBeenCalledTimes(1);
      expect(mockBuildAndSendTx.mock.calls[0][2]).toBe("place_bet");
    });

    it("passes amount as i128 BigInt stroops", async () => {
      const mockSign = vi.fn();
      mockBuildAndSendTx.mockResolvedValueOnce({ success: true, hash: "h" });

      await placeBet("GUSER", 1, true, 100, mockSign);
      // 4th arg (index 3) in args array is the i128Val for amount
      const args = mockBuildAndSendTx.mock.calls[0][3] as { type: string; value: bigint }[];
      const amountArg = args[3]; // [address, u64, bool, i128]
      expect(amountArg.type).toBe("i128");
      expect(amountArg.value).toBe(1_000_000_000n); // 100 XLM = 1_000_000_000 stroops
    });

    it("returns error result on failure", async () => {
      const mockSign = vi.fn();
      mockBuildAndSendTx.mockResolvedValueOnce({
        success: false,
        error: "Tx failed",
      });

      const result = await placeBet("GUSER", 1, true, 100, mockSign);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Tx failed");
    });
  });

  describe("resolveMarket", () => {
    it("sends correct outcome", async () => {
      const mockSign = vi.fn();
      mockBuildAndSendTx.mockResolvedValueOnce({ success: true, hash: "h1" });

      const result = await resolveMarket("GADMIN", 1, true, mockSign);
      expect(result.success).toBe(true);
      expect(mockBuildAndSendTx.mock.calls[0][2]).toBe("resolve_market");
    });
  });

  describe("claim", () => {
    it("returns transaction result", async () => {
      const mockSign = vi.fn();
      mockBuildAndSendTx.mockResolvedValueOnce({
        success: true,
        hash: "claim_hash",
      });

      const result = await claim("GUSER", 1, mockSign);
      expect(result.success).toBe(true);
      expect(mockBuildAndSendTx.mock.calls[0][2]).toBe("claim");
    });
  });

  describe("cancelRefund", () => {
    it("calls cancel_refund method", async () => {
      const mockSign = vi.fn();
      mockBuildAndSendTx.mockResolvedValueOnce({
        success: true,
        hash: "refund_hash",
      });

      const result = await cancelRefund("GUSER", 1, mockSign);
      expect(result.success).toBe(true);
      expect(mockBuildAndSendTx.mock.calls[0][2]).toBe("cancel_refund");
    });
  });
});
