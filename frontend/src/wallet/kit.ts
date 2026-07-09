import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  xBullModule,
  AlbedoModule,
  FREIGHTER_ID,
  XBULL_ID,
  ALBEDO_ID,
} from "@creit.tech/stellar-wallets-kit";
import { NETWORK } from "@/config/network";
import { AppErrorType } from "@/types";
import type { WalletType } from "./types";

// ── Wallet ID mapping ─────────────────────────────────────────────────────────

const WALLET_ID_MAP: Record<WalletType, string> = {
  freighter: FREIGHTER_ID,
  xbull: XBULL_ID,
  albedo: ALBEDO_ID,
};

// ── Singleton instance ────────────────────────────────────────────────────────

let _kit: StellarWalletsKit | null = null;

/**
 * Get or create the StellarWalletsKit singleton.
 * Lazy-initialized on first call with Freighter, xBull, and Albedo modules.
 */
export function getWalletKit(): StellarWalletsKit {
  if (!_kit) {
    const networkPassphrase =
      NETWORK.passphrase === "Test SDF Network ; September 2015"
        ? WalletNetwork.TESTNET
        : WalletNetwork.PUBLIC;

    _kit = new StellarWalletsKit({
      network: networkPassphrase,
      selectedWalletId: FREIGHTER_ID,
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new AlbedoModule(),
      ],
    });
  }
  return _kit;
}

/**
 * Select a wallet type in the kit.
 */
export function selectWallet(type: WalletType): void {
  const kit = getWalletKit();
  const walletId = WALLET_ID_MAP[type];
  kit.setWallet(walletId);
}

/**
 * Connect to the selected wallet and return the public key.
 */
export async function connectKit(): Promise<{ publicKey: string }> {
  try {
    const kit = getWalletKit();
    const { address } = await kit.getAddress();
    return { publicKey: address };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to connect wallet";

    // Detect extension not installed
    if (
      message.toLowerCase().includes("not installed") ||
      message.toLowerCase().includes("not available") ||
      message.toLowerCase().includes("no provider")
    ) {
      throw {
        type: AppErrorType.WALLET,
        message: "Wallet extension not installed",
        details: message,
      };
    }

    // Detect user rejection
    if (
      message.toLowerCase().includes("rejected") ||
      message.toLowerCase().includes("denied") ||
      message.toLowerCase().includes("cancelled")
    ) {
      throw {
        type: AppErrorType.WALLET,
        message: "Connection request rejected by user",
        details: message,
      };
    }

    throw {
      type: AppErrorType.WALLET,
      message: "Failed to connect wallet",
      details: message,
    };
  }
}

/**
 * Sign a transaction XDR string with the currently selected wallet.
 * Returns the signed XDR string.
 */
export async function signWithKit(xdr: string): Promise<string> {
  try {
    const kit = getWalletKit();
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase: NETWORK.passphrase,
    });
    return signedTxXdr;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to sign transaction";

    if (
      message.toLowerCase().includes("rejected") ||
      message.toLowerCase().includes("denied") ||
      message.toLowerCase().includes("cancelled")
    ) {
      throw {
        type: AppErrorType.WALLET,
        message: "Transaction signing rejected by user",
        details: message,
      };
    }

    throw {
      type: AppErrorType.WALLET,
      message: "Failed to sign transaction",
      details: message,
    };
  }
}
