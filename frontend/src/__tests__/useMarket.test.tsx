import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Market, Bet } from "@/types";

const mocks = vi.hoisted(() => ({
    getMarket: vi.fn(),
    getBet: vi.fn(),
}));

vi.mock("@/services/market", () => ({
    getMarket: mocks.getMarket,
    getBet: mocks.getBet,
}));

let walletState: { publicKey: string | null } = { publicKey: null };

vi.mock("@/hooks/useWallet", () => ({
    useWallet: () => walletState,
}));

import { useMarket } from "@/hooks/useMarket";

const market: Market = {
    id: 1,
    question: "Will XLM close above $1?",
    imageUrl: "",
    category: "Crypto",
    endTime: 1_800_000_000,
    totalYes: 120,
    totalNo: 80,
    resolved: false,
    outcome: false,
    cancelled: false,
    creator: "GCREATOR",
    betCount: 7,
};

const bet: Bet = {
    amount: 25,
    isYes: true,
    claimed: false,
};

describe("useMarket", () => {
    beforeEach(() => {
          vi.clearAllMocks();
          walletState = { publicKey: null };
    });

           afterEach(() => {
                 vi.restoreAllMocks();
           });

           it("starts in the loading state with no data", () => {
                 // Keep the request pending so we can observe the initial state
                  mocks.getMarket.mockReturnValue(new Promise(() => {}));

                  const { result } = renderHook(() => useMarket(1));

                  expect(result.current.loading).toBe(true);
                 expect(result.current.market).toBeNull();
                 expect(result.current.userBet).toBeNull();
                 expect(result.current.error).toBeNull();
           });

           it("loads the market and clears loading on success (no wallet)", async () => {
                 mocks.getMarket.mockResolvedValue(market);

                  const { result } = renderHook(() => useMarket(1));

                  await waitFor(() => expect(result.current.loading).toBe(false));

                  expect(result.current.market).toEqual(market);
                 expect(result.current.error).toBeNull();
                 expect(result.current.userBet).toBeNull();
                 // Without a connected wallet the user's bet must not be requested
                  expect(mocks.getBet).not.toHaveBeenCalled();
           });

           it("fetches the user's bet when a wallet is connected", async () => {
                 walletState = { publicKey: "GUSER" };
                 mocks.getMarket.mockResolvedValue(market);
                 mocks.getBet.mockResolvedValue(bet);

                  const { result } = renderHook(() => useMarket(1));

                  await waitFor(() => expect(result.current.loading).toBe(false));

                  expect(mocks.getBet).toHaveBeenCalledWith(1, "GUSER");
                 expect(result.current.userBet).toEqual(bet);
           });

           it("keeps the market but nulls the bet when getBet rejects", async () => {
                 walletState = { publicKey: "GUSER" };
                 mocks.getMarket.mockResolvedValue(market);
                 mocks.getBet.mockRejectedValue(new Error("bet lookup failed"));

                  const { result } = renderHook(() => useMarket(1));

                  await waitFor(() => expect(result.current.loading).toBe(false));

                  expect(result.current.market).toEqual(market);
                 expect(result.current.userBet).toBeNull();
                 expect(result.current.error).toBeNull();
           });

           it("reports 'Market not found' when the market does not exist", async () => {
                 mocks.getMarket.mockResolvedValue(null);

                  const { result } = renderHook(() => useMarket(999));

                  await waitFor(() => expect(result.current.loading).toBe(false));

                  expect(result.current.error).toBe("Market not found");
                 expect(result.current.market).toBeNull();
                 expect(result.current.userBet).toBeNull();
           });

           it("surfaces the error message when getMarket rejects", async () => {
                 mocks.getMarket.mockRejectedValue(new Error("RPC unavailable"));

                  const { result } = renderHook(() => useMarket(1));

                  await waitFor(() => expect(result.current.loading).toBe(false));

                  expect(result.current.error).toBe("RPC unavailable");
                 expect(result.current.market).toBeNull();
           });

           it("falls back to a generic message for non-Error rejections", async () => {
                 mocks.getMarket.mockRejectedValue("boom");

                  const { result } = renderHook(() => useMarket(1));

                  await waitFor(() => expect(result.current.loading).toBe(false));

                  expect(result.current.error).toBe("Failed to load market");
           });

           it("skips fetching entirely for invalid ids", async () => {
                 const { result } = renderHook(() => useMarket(0));

                  await waitFor(() => expect(result.current.loading).toBe(false));

                  expect(mocks.getMarket).not.toHaveBeenCalled();
                 expect(result.current.market).toBeNull();
                 expect(result.current.error).toBeNull();
           });

           it("refetch reloads data silently without toggling loading", async () => {
                 mocks.getMarket.mockResolvedValue(market);

                  const { result } = renderHook(() => useMarket(1));
                 await waitFor(() => expect(result.current.loading).toBe(false));

                  const updated: Market = { ...market, totalYes: 150, betCount: 8 };
                 mocks.getMarket.mockResolvedValue(updated);

                  await act(async () => {
                          result.current.refetch();
                  });

                  await waitFor(() => expect(result.current.market).toEqual(updated));
                 // Silent refresh: loading skeleton must not reappear
                  expect(result.current.loading).toBe(false);
                 expect(mocks.getMarket).toHaveBeenCalledTimes(2);
           });

           it("clears a previous error after a successful refetch", async () => {
                 mocks.getMarket.mockRejectedValueOnce(new Error("RPC unavailable"));
                 mocks.getMarket.mockResolvedValue(market);

                  const { result } = renderHook(() => useMarket(1));
                 await waitFor(() => expect(result.current.error).toBe("RPC unavailable"));

                  await act(async () => {
                          result.current.refetch();
                  });

                  await waitFor(() => expect(result.current.market).toEqual(market));
                 expect(result.current.error).toBeNull();
           });

           it("ignores responses that resolve after unmount", async () => {
                 let resolveMarket: (m: Market) => void = () => {};
                 mocks.getMarket.mockReturnValue(
                         new Promise<Market>((resolve) => {
                                   resolveMarket = resolve;
                         })
                       );

                  const { result, unmount } = renderHook(() => useMarket(1));
                 unmount();

                  await act(async () => {
                          resolveMarket(market);
                  });

                  // State must not have been updated after unmount
                  expect(result.current.market).toBeNull();
                 expect(result.current.loading).toBe(true);
           });
});
