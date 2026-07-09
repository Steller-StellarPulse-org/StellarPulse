import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSignTransaction = vi.fn();

let walletState = {
  publicKey: null as string | null,
  connected: false,
  connecting: false,
  error: null as null,
  connect: mockConnect,
  disconnect: mockDisconnect,
  signTransaction: mockSignTransaction,
  walletType: null as null,
};

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => walletState,
}));

// Stub WalletModal
vi.mock("@/components/wallet/WalletModal", () => ({
  default: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="wallet-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

import WalletConnect from "@/components/wallet/WalletConnect";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("WalletConnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletState = {
      publicKey: null,
      connected: false,
      connecting: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      signTransaction: mockSignTransaction,
      walletType: null,
    };
  });

  describe("disconnected state", () => {
    it("renders Connect Wallet button", () => {
      render(<WalletConnect />);
      expect(screen.getByText(/Connect Wallet/i)).toBeInTheDocument();
    });

    it("button is enabled and clickable", () => {
      render(<WalletConnect />);
      const btn = screen.getByRole("button", { name: /Connect Wallet/i });
      expect(btn).toBeEnabled();
    });

    it("opens wallet modal on click", () => {
      render(<WalletConnect />);
      expect(screen.queryByTestId("wallet-modal")).not.toBeInTheDocument();
      fireEvent.click(screen.getByText(/Connect Wallet/i));
      expect(screen.getByTestId("wallet-modal")).toBeInTheDocument();
    });
  });

  describe("connected state", () => {
    beforeEach(() => {
      walletState = {
        ...walletState,
        publicKey: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ",
        connected: true,
      };
    });

    it("shows truncated address instead of Connect button", () => {
      render(<WalletConnect />);
      // truncateAddress: first 4 + "..." + last 4 = GABC...NOPQ
      expect(screen.getByText(/GABC/)).toBeInTheDocument();
      expect(screen.queryByText(/Connect Wallet/i)).not.toBeInTheDocument();
    });

    it("opens dropdown on address click", () => {
      render(<WalletConnect />);
      const addrBtn = screen.getByText(/GABC/);
      fireEvent.click(addrBtn);
      expect(screen.getByText("Copy Address")).toBeInTheDocument();
      expect(screen.getByText("Disconnect")).toBeInTheDocument();
    });

    it("calls disconnect when Disconnect is clicked", () => {
      render(<WalletConnect />);
      fireEvent.click(screen.getByText(/GABC/));
      fireEvent.click(screen.getByText("Disconnect"));
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
