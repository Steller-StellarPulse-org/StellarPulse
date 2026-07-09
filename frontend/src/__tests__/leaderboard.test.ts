import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSimulateTransaction = vi.fn();

vi.mock("@/services/soroban", () => ({
  simulateTransaction: (...args: unknown[]) => mockSimulateTransaction(...args),
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
  xdr: {},
}));

vi.mock("@/config/network", () => ({
  LEADERBOARD_CONTRACT_ID: "CLEADERBOARD",
  ADMIN_PUBLIC_KEY: "GADMIN456",
}));

import { getTopPlayers, getStats, getPoints, getRank } from "@/services/leaderboard";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("leaderboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTopPlayers", () => {
    it("returns sorted array of PlayerStats", async () => {
      // get_top_players returns Vec<(Address, u64)>
      mockSimulateTransaction.mockResolvedValueOnce([
        ["GALICE", 1000n],
        ["GBOB", 500n],
      ]);
      // get_stats for Alice
      mockSimulateTransaction.mockResolvedValueOnce([1000n, 15n, 10n, 5n]);
      // get_stats for Bob
      mockSimulateTransaction.mockResolvedValueOnce([500n, 10n, 6n, 4n]);

      const players = await getTopPlayers(10);
      expect(players).toHaveLength(2);
      expect(players[0].address).toBe("GALICE");
      expect(players[0].points).toBe(1000);
      expect(players[0].totalBets).toBe(15);
      expect(players[0].wonBets).toBe(10);
      expect(players[0].winRate).toBeCloseTo(66.67, 1);
      expect(players[1].address).toBe("GBOB");
      expect(players[1].points).toBe(500);
    });

    it("returns empty array when no players", async () => {
      mockSimulateTransaction.mockResolvedValueOnce([]);
      const players = await getTopPlayers(10);
      expect(players).toEqual([]);
    });

    it("returns empty array on error", async () => {
      mockSimulateTransaction.mockRejectedValueOnce(new Error("network"));
      const players = await getTopPlayers(10);
      expect(players).toEqual([]);
    });

    it("handles stats fetch failure gracefully", async () => {
      mockSimulateTransaction.mockResolvedValueOnce([["GALICE", 100n]]);
      // stats call fails
      mockSimulateTransaction.mockRejectedValueOnce(new Error("fail"));

      const players = await getTopPlayers(10);
      expect(players).toHaveLength(1);
      expect(players[0].points).toBe(100);
      expect(players[0].totalBets).toBe(0); // fallback
      expect(players[0].winRate).toBe(0);
    });
  });

  describe("getStats", () => {
    it("returns player stats for a user", async () => {
      mockSimulateTransaction.mockResolvedValueOnce([800n, 20n, 12n, 8n]);

      const stats = await getStats("GUSER");
      expect(stats).not.toBeNull();
      expect(stats!.points).toBe(800);
      expect(stats!.totalBets).toBe(20);
      expect(stats!.wonBets).toBe(12);
      expect(stats!.lostBets).toBe(8);
      expect(stats!.winRate).toBe(60);
    });

    it("returns null on error", async () => {
      mockSimulateTransaction.mockRejectedValueOnce(new Error("fail"));
      const stats = await getStats("GUSER");
      expect(stats).toBeNull();
    });
  });

  describe("getPoints", () => {
    it("returns numeric points", async () => {
      mockSimulateTransaction.mockResolvedValueOnce(1234n);
      const pts = await getPoints("GUSER");
      expect(pts).toBe(1234);
    });

    it("returns 0 on error", async () => {
      mockSimulateTransaction.mockRejectedValueOnce(new Error("fail"));
      const pts = await getPoints("GUSER");
      expect(pts).toBe(0);
    });
  });

  describe("getRank", () => {
    it("returns numeric rank", async () => {
      mockSimulateTransaction.mockResolvedValueOnce(3n);
      const rank = await getRank("GUSER");
      expect(rank).toBe(3);
    });

    it("returns 0 on error", async () => {
      mockSimulateTransaction.mockRejectedValueOnce(new Error("fail"));
      const rank = await getRank("GUSER");
      expect(rank).toBe(0);
    });
  });
});
