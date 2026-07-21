import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

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

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    publicKey: null,
    connected: false,
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
  }),
}));

// Stub WalletModal — it depends on external wallet kits
vi.mock("@/components/wallet/WalletModal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="wallet-modal">WalletModal</div> : null,
}));

// Stub MobileMenu
vi.mock("@/components/layout/MobileMenu", () => ({
  default: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="mobile-menu">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

import Navbar from "@/components/layout/Navbar";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Navbar", () => {
  beforeEach(() => {
    mockPathname = "/";
  });

  it("renders the logo / brand name", () => {
    render(<Navbar />);
    expect(screen.getByText(/StellarPulse/i)).toBeInTheDocument();
  });

  it("renders all navigation links", () => {
    render(<Navbar />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Markets")).toBeInTheDocument();
    expect(screen.getByText("Leaderboard")).toBeInTheDocument();
  });

  it("renders the wallet connect button", () => {
    render(<Navbar />);
    expect(screen.getByText(/Connect Wallet/i)).toBeInTheDocument();
  });

  it("logo links to home page", () => {
    render(<Navbar />);
    const logo = screen.getByText(/StellarPulse/i);
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });

  it("nav links point to correct paths", () => {
    render(<Navbar />);
    const marketsLink = screen.getByText("Markets").closest("a");
    expect(marketsLink).toHaveAttribute("href", "/markets");
    const leaderboardLink = screen.getByText("Leaderboard").closest("a");
    expect(leaderboardLink).toHaveAttribute("href", "/leaderboard");
  });

  it("hamburger button opens mobile menu", () => {
    render(<Navbar />);
    const hamburger = screen.getByLabelText("Open menu");
    expect(screen.queryByTestId("mobile-menu")).not.toBeInTheDocument();
    fireEvent.click(hamburger);
    expect(screen.getByTestId("mobile-menu")).toBeInTheDocument();
  });

  it("mobile menu can be closed", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(screen.getByTestId("mobile-menu")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Close"));
    expect(screen.queryByTestId("mobile-menu")).not.toBeInTheDocument();
  });
});
