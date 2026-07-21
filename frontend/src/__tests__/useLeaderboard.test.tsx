import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

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
  const player = {
    address: "GALICE",
    displayName: "Alice",
    points: 100,
    totalBets: 4,
    wonBets: 3,
    lostBets: 1,
    winRate: 75,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMarkets.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records Unix seconds only after a successful refresh", async () => {
    const refreshedAtMs = 1_800_000_000_123;
    vi.spyOn(Date, "now").mockReturnValue(refreshedAtMs);
    mocks.getTopPlayers.mockResolvedValue([player]);

    const { result } = renderHook(() => useLeaderboard("top_predictors"));

    expect(result.current.lastUpdated).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.lastUpdated).toBe(Math.floor(refreshedAtMs / 1000));
  });

  it("keeps the previous timestamp when services return no refreshed data", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    mocks.getTopPlayers.mockResolvedValueOnce([player]);

    const { result } = renderHook(() => useLeaderboard("top_predictors"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const successfulRefresh = result.current.lastUpdated;
    expect(successfulRefresh).not.toBeNull();

    now.mockReturnValue(1_900_000_000_000);
    let resolveRefresh!: (players: never[]) => void;
    const emptyRefresh = new Promise<never[]>((resolve) => {
      resolveRefresh = resolve;
    });
    mocks.getTopPlayers.mockReturnValueOnce(emptyRefresh);

    act(() => result.current.refetch());
    await act(async () => {
      resolveRefresh([]);
      await emptyRefresh;
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lastUpdated).toBe(successfulRefresh);
  });
});
