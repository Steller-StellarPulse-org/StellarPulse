import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getTopPlayers: vi.fn(),
  getStats: vi.fn(),
  getMarkets: vi.fn(),
  getMarketBettors: vi.fn(),
  getDisplayName: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/services/leaderboard", () => ({
  getTopPlayers: mocks.getTopPlayers,
  getStats: mocks.getStats,
}));

vi.mock("@/services/market", () => ({
  getMarkets: mocks.getMarkets,
  getMarketBettors: mocks.getMarketBettors,
}));

vi.mock("@/services/referral", () => ({
  getDisplayName: mocks.getDisplayName,
}));

vi.mock("@/services/cache", () => ({
  getStale: () => null,
  set: mocks.cacheSet,
}));

vi.mock("@/hooks/useVisiblePoll", () => ({
  useVisiblePoll: vi.fn(),
}));

import { useLeaderboard } from "@/hooks/useLeaderboard";

describe("useLeaderboard lastUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMarkets.mockResolvedValue([]);
  });

  it("records a millisecond timestamp after a successful refresh", async () => {
    const refreshedAt = 1_800_000_000_123;
    vi.spyOn(Date, "now").mockReturnValue(refreshedAt);
    mocks.getTopPlayers.mockResolvedValue([
      {
        address: "GALICE",
        displayName: "Alice",
        points: 100,
        totalBets: 4,
        wonBets: 3,
        lostBets: 1,
        winRate: 75,
      },
    ]);

    const { result } = renderHook(() => useLeaderboard("top_predictors"));

    expect(result.current.lastUpdated).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.lastUpdated).toBe(refreshedAt);
  });

  it("does not claim a refresh time when loading fails", async () => {
    mocks.getTopPlayers.mockRejectedValue(new Error("RPC unavailable"));

    const { result } = renderHook(() => useLeaderboard("top_predictors"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("RPC unavailable");
    expect(result.current.lastUpdated).toBeNull();
  });
});
