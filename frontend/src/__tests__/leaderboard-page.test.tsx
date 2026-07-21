import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lastUpdated: 1_800_000_000 as number | null,
  formatDate: vi.fn(() => "localized timestamp"),
}));

vi.mock("@/hooks/useLeaderboard", () => ({
  useLeaderboard: () => ({
    data: [],
    loading: false,
    error: null,
    lastUpdated: mocks.lastUpdated,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ publicKey: null }),
}));

vi.mock("@/utils/helpers", () => ({
  formatDate: mocks.formatDate,
}));

import LeaderboardPage from "@/app/leaderboard/page";

describe("LeaderboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lastUpdated = 1_800_000_000;
  });

  it("formats the last successful leaderboard refresh", () => {
    render(<LeaderboardPage />);

    expect(screen.getByText("Last updated: localized timestamp")).toBeInTheDocument();
    expect(mocks.formatDate).toHaveBeenCalledWith(1_800_000_000);
  });

  it("hides the label before any successful refresh", () => {
    mocks.lastUpdated = null;
    render(<LeaderboardPage />);

    expect(screen.queryByText(/^Last updated:/)).not.toBeInTheDocument();
  });
});
