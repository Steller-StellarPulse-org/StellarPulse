export type WalletType = "freighter" | "albedo" | "xbull";

export interface Wallet {
  publicKey: string;
  walletType: WalletType;
}
