import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLeaderboard } from "@/hooks/useLeaderboard";

const mockGetTopPlayers = vi.fn();

vi.mock("@/services/leaderboard", () => ({
  getTopPlayers: (...args: unknown[]) => mockGetTopPlayers(...args),
  getStats: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/services/market", () => ({
  getMarkets: vi.fn().mockResolvedValue([]),
  getMarketBettors: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/referral", () => ({
  getDisplayName: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/services/cache", () => ({
  get: vi.fn(() => null),
  getStale: vi.fn(() => null),
  set: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
}));

vi.mock("@/hooks/useVisiblePoll", () => ({
  useVisiblePoll: vi.fn(),
}));

beforeEach(() => {
  mockGetTopPlayers.mockReset();
});

describe("useLeaderboard - lastUpdated", () => {
  it("stays null until the first fetch resolves", async () => {
    mockGetTopPlayers.mockResolvedValue([]);
    const { result } = renderHook(() => useLeaderboard("top_predictors"));

    expect(result.current.lastUpdated).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lastUpdated).not.toBeNull();
  });

  it("does not update lastUpdated when a refresh fails", async () => {
    mockGetTopPlayers.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useLeaderboard("top_predictors"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const firstStamp = result.current.lastUpdated;
    expect(firstStamp).not.toBeNull();

    mockGetTopPlayers.mockRejectedValueOnce(new Error("RPC unavailable"));
    result.current.refetch();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    // A failed refresh must not overwrite lastUpdated with a fresh-looking
    expect(result.current.lastUpdated).toBe(firstStamp);
  });
});
