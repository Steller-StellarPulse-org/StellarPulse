import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { Market } from "@/types";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

vi.mock("@/components/market/MarketImage", () => ({
  default: ({ alt }: { alt: string }) => (
    <div data-testid="market-image">{alt}</div>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

import MarketCard from "@/components/market/MarketCard";

const futureTime = Math.floor(Date.now() / 1000) + 86400; // +1 day

const mockMarket: Market = {
  id: 42,
  question: "Will BTC reach $100k?",
  imageUrl: "/test.png",
  category: "Crypto",
  endTime: futureTime,
  totalYes: 500,
  totalNo: 300,
  resolved: false,
  outcome: false,
  cancelled: false,
  creator: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ",
  betCount: 10,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("MarketCard", () => {
  it("renders the market question", () => {
    render(<MarketCard market={mockMarket} />);
    // Question appears in both MarketImage alt and h3 — use heading role
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      /Will BTC reach \$100k\?/
    );
  });

  it("renders pool amount in XLM", () => {
    render(<MarketCard market={mockMarket} />);
    expect(screen.getByText(/XLM/i)).toBeInTheDocument();
  });

  it("renders countdown timer", () => {
    render(<MarketCard market={mockMarket} />);
    // CountdownTimer renders remaining time like "23h 59m" or "1d 0h 0m"
    expect(screen.getByText(/\d+[dhms]/i)).toBeInTheDocument();
  });

  it("links to the market detail page", () => {
    render(<MarketCard market={mockMarket} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/markets/42");
  });

  it("renders odds percentages via OddsBar", () => {
    render(<MarketCard market={mockMarket} />);
    // calculateOdds(500, 300) → YES 63%, NO 37%
    // Text is split across elements: "YES " + "63" + "%"
    expect(screen.getByText(/63/)).toBeInTheDocument();
    expect(screen.getByText(/37/)).toBeInTheDocument();
  });

  it("shows bet count", () => {
    render(<MarketCard market={mockMarket} />);
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("displays Active badge for an active market", () => {
    render(<MarketCard market={mockMarket} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("displays Resolved badge for a resolved market", () => {
    const resolved = { ...mockMarket, resolved: true, outcome: true };
    render(<MarketCard market={resolved} />);
    expect(screen.getByText("Resolved YES")).toBeInTheDocument();
  });

  it("displays Cancelled badge for a cancelled market", () => {
    const cancelled = { ...mockMarket, cancelled: true };
    render(<MarketCard market={cancelled} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("shows Ended badge when market end time has passed", () => {
    const ended = {
      ...mockMarket,
      endTime: Math.floor(Date.now() / 1000) - 100,
    };
    render(<MarketCard market={ended} />);
    // "Ended" appears in both the Badge and CountdownTimer
    const endedElements = screen.getAllByText("Ended");
    expect(endedElements.length).toBeGreaterThanOrEqual(1);
  });
});
