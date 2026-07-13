import {
  rpc,
  Horizon,
  TransactionBuilder,
  Transaction,
  Contract,
  Networks,
  Keypair,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";
import { NETWORK, ADMIN_PUBLIC_KEY, SPONSOR_SECRET_KEY, resolveSorobanUrl } from "@/config/network";
import { AppErrorType } from "@/types";
import type { AppError, TransactionResult } from "@/types";
import * as cache from "@/services/cache";
import { sorobanRpcLimiter } from "@/utils/rateLimit";

const XLM_BALANCE_TTL = 15_000;

// ── Simulation source account ─────────────────────────────────────────────────
// Read-only simulations need any funded Stellar account as the tx source —
// it is NOT used for signing, only for sequence-number lookup. This lets the
// markets/leaderboard load BEFORE the user connects a wallet.
//
// Priority: connected wallet > admin key (the deployer, always funded & exists).
// We deliberately do NOT keep a third hardcoded fallback — the admin/deployer
// account always exists on the network the contracts were deployed to, so it
// is the most reliable anonymous source. A wrong fallback (e.g. an account that
// does not exist on this network) causes "Account not found" and makes the app
// appear to require a wallet before showing data.
let _connectedWallet: string | null = null;

/** Call this when the user connects their wallet so simulations use their account. */
export function setSimulationSource(publicKey: string | null): void {
  _connectedWallet = publicKey;
}

/** Returns the best available source account for read-only simulations. */
export function getSimulationSource(): string {
  return _connectedWallet || ADMIN_PUBLIC_KEY;
}

// ── Server singletons ─────────────────────────────────────────────────────────

let _sorobanServer: rpc.Server | null = null;
let _horizonServer: Horizon.Server | null = null;

/**
 * Get a rpc.Server instance for the configured network.
 */
export function getSorobanServer(): rpc.Server {
  if (!_sorobanServer) {
    // Resolve at call-time (not module-eval) so the browser correctly picks the
    // same-origin /api/rpc proxy even if this module was first imported on the
    // server. NETWORK.sorobanUrl already does the browser-vs-server selection.
    const url = resolveSorobanUrl();
    _sorobanServer = new rpc.Server(url, {
      allowHttp: url.startsWith("http://"),
    });
  }
  return _sorobanServer;
}

/**
 * Get a Horizon.Server instance for the configured network.
 */
export function getHorizonServer(): Horizon.Server {
  if (!_horizonServer) {
    _horizonServer = new Horizon.Server(NETWORK.url);
  }
  return _horizonServer;
}

/**
 * Fetch native XLM balance for an account via Horizon.
 * Returns balance in XLM (human-readable units, e.g. 100.5).
 */
export async function getXlmBalance(publicKey: string): Promise<number> {
  const cacheKey = `xlm_balance_${publicKey}`;
  const cached = cache.get<number>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  try {
    const server = getHorizonServer();
    const account = await server.loadAccount(publicKey);
    const nativeBalance = account.balances.find(
      (b: { asset_type: string }) => b.asset_type === "native"
    );
    const balance = nativeBalance
      ? parseFloat((nativeBalance as { balance: string }).balance)
      : 0;
    cache.set(cacheKey, balance, XLM_BALANCE_TTL);
    return balance;
  } catch {
    return 0;
  }
}

// ── Network passphrase helper ─────────────────────────────────────────────────

function getNetworkPassphrase(): string {
  if (NETWORK.passphrase === Networks.TESTNET) return Networks.TESTNET;
  if (NETWORK.passphrase === Networks.PUBLIC) return Networks.PUBLIC;
  return NETWORK.passphrase;
}

// ── Transaction polling ───────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 45; // 90 seconds total

/**
 * Poll the Soroban RPC getTransaction endpoint until the tx is confirmed
 * (success or failure) or we time out.
 */
async function pollTransaction(
  server: rpc.Server,
  hash: string
): Promise<rpc.Api.GetTransactionResponse> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const response = await server.getTransaction(hash);

    if (response.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return response;
    }
    if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
      return response;
    }

    // NOT_FOUND — still pending, wait and retry
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw createAppError(
    AppErrorType.TIMEOUT,
    "Transaction confirmation timed out",
    `Hash: ${hash} — polled ${MAX_POLL_ATTEMPTS} times`
  );
}

// ── Core: buildAndSendTx ──────────────────────────────────────────────────────

/**
 * Build, simulate, sign, and submit a Soroban contract call transaction.
 *
 * @param publicKey — Caller's Stellar public key
 * @param contractId — Deployed contract address (C...)
 * @param method — Contract function name
 * @param args — Array of xdr.ScVal arguments
 * @param signTransaction — Wallet sign function (XDR in → signed XDR out)
 * @returns TransactionResult with success status and hash or error
 */
export async function buildAndSendTx(
  publicKey: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  signTransaction: (xdr: string) => Promise<string>
): Promise<TransactionResult> {
  const server = getSorobanServer();

  try {
    // 1. Load the source account (for sequence number)
    const sourceAccount = await server.getAccount(publicKey);

    // 2. Build the contract call operation
    const contract = new Contract(contractId);
    const operation = contract.call(method, ...args);
    
    const INCLUSION_FEE = "50000"; // 0.005 XLM inclusion buffer
    const tx = new TransactionBuilder(sourceAccount, {
      fee: INCLUSION_FEE,
      networkPassphrase: getNetworkPassphrase(),
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // 4. Simulate + prepare — adds the exact resource fee on top of the
    //    inclusion fee above, and embeds the footprint. We sign this directly
    //    so the Soroban resource data is preserved (cloning drops it).
    let prepared;
    try {
      prepared = await server.prepareTransaction(tx);
    } catch (simErr) {
      console.error("[StellarPulse] Simulation/prepare failed:", simErr);
      const simMsg = simErr instanceof Error ? simErr.message : String(simErr);
      return {
        success: false,
        error: `Simulation failed: ${simMsg}`,
      };
    }

    // 5. Read the prepared total fee (inclusion + resource) for the fee-bump cap.
    const preparedFee = parseInt(prepared.fee, 10);

    // 6. Sign the prepared transaction (footprint + resource fee intact).
    const txXdr = prepared.toXDR();
    let signedXdr: string;
    try {
      signedXdr = await signTransaction(txXdr);
    } catch (signErr) {
      console.error("[StellarPulse] Wallet signing failed:", signErr);
      const signMsg = signErr instanceof Error ? signErr.message : extractErrorMessage(signErr);
      return {
        success: false,
        error: `Signing failed: ${signMsg}`,
      };
    }

    // 7. Reconstruct and submit (with fee bump if sponsor is configured)
    const parsedTx = TransactionBuilder.fromXDR(
      signedXdr,
      getNetworkPassphrase()
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let txToSubmit: any = parsedTx;

    // Fee Sponsorship: wrap in FeeBumpTransaction — sponsor pays the resource fee,
    // user pays nothing. The fee bump cap is set to 2× the simulated fee so the
    // sponsor never overpays and the cap shown in explorers is realistic.
    if (SPONSOR_SECRET_KEY && parsedTx instanceof Transaction) {
      try {
        const sponsorKeypair = Keypair.fromSecret(SPONSOR_SECRET_KEY);
        // Bump cap = 2× simulated fee (never more than 0.5 XLM on testnet)
        const bumpCap = Math.min(
          Math.ceil(preparedFee * 2),
          5_000_000 // hard ceiling: 0.5 XLM — prevents runaway fees
        ).toString();
        const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
          sponsorKeypair,
          bumpCap,
          parsedTx,
          getNetworkPassphrase()
        );
        feeBumpTx.sign(sponsorKeypair);
        txToSubmit = feeBumpTx;
        console.log(`[StellarPulse] Fee bump applied — sponsor pays up to ${parseInt(bumpCap)/1e7} XLM`);
      } catch (bumpErr) {
        console.warn("[StellarPulse] Fee bump failed, falling back to user-paid:", bumpErr);
      }
    }

    const sendResponse = await server.sendTransaction(txToSubmit);

    // 7. Check immediate send status
    if (sendResponse.status === "ERROR") {
      console.error("[StellarPulse] sendTransaction ERROR:", JSON.stringify(sendResponse, null, 2));
      const errorDetail = extractSendError(sendResponse);
      return {
        success: false,
        error: `Transaction rejected: ${errorDetail}`,
      };
    }

    if (sendResponse.status === "TRY_AGAIN_LATER") {
      return {
        success: false,
        error: "Network busy — please try again in a few seconds",
      };
    }

    // 8. Poll for confirmation
    const txResponse = await pollTransaction(server, sendResponse.hash);

    if (
      txResponse.status === rpc.Api.GetTransactionStatus.SUCCESS
    ) {
      return { success: true, hash: sendResponse.hash };
    }

    // Transaction failed on-chain — extract reason
    console.error("[StellarPulse] Transaction failed on-chain:", JSON.stringify(txResponse, null, 2));
    const onChainError = extractOnChainError(txResponse);
    return {
      success: false,
      hash: sendResponse.hash,
      error: `Transaction failed: ${onChainError}`,
    };
  } catch (err) {
    console.error("[StellarPulse] buildAndSendTx unexpected error:", err);
    throw classifyError(err);
  }
}

// ── Read-only simulation ──────────────────────────────────────────────────────

/**
 * Simulate a read-only contract call and return the parsed native result.
 * Does NOT submit the transaction — used for view functions (getMarket, etc.).
 *
 * @param publicKey — Any valid Stellar public key (used as tx source for sim)
 * @param contractId — Deployed contract address
 * @param method — Contract function name
 * @param args — Array of xdr.ScVal arguments
 * @returns Parsed native JS value from the contract return
 */
// ── Source-account cache for read-only simulations ───────────────────────────
// Read-only simulations don't care about the sequence number — the host ignores
// it. So we fetch the source account ONCE and reuse it for ~60s across every
// simulation, eliminating a full network round-trip (getAccount) per read.
// This is the single biggest win for 100s of concurrent users hitting the
// markets/leaderboard pages: each read drops from 2 round-trips to 1.
let _simAccount: { account: Awaited<ReturnType<rpc.Server["getAccount"]>>; key: string; expiry: number } | null = null;
const SIM_ACCOUNT_TTL = 60_000;

async function getSimAccount(publicKey: string) {
  const now = Date.now();
  if (_simAccount && _simAccount.key === publicKey && now < _simAccount.expiry) {
    return _simAccount.account;
  }
  const account = await getSorobanServer().getAccount(publicKey);
  _simAccount = { account, key: publicKey, expiry: now + SIM_ACCOUNT_TTL };
  return account;
}

export async function simulateTransaction<T = unknown>(
  publicKey: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<T> {
  const server = getSorobanServer();

  try {
    const sourceAccount = await getSimAccount(publicKey);
    const contract = new Contract(contractId);
    const operation = contract.call(method, ...args);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: getNetworkPassphrase(),
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    // Throttle the RPC read to avoid provider rate-limiting under bursty load.
    await sorobanRpcLimiter.acquire();
    const simResponse = await server.simulateTransaction(tx);

    // Check for simulation error
    if (rpc.Api.isSimulationError(simResponse)) {
      throw createAppError(
        AppErrorType.SIMULATION,
        "Simulation failed",
        simResponse.error
      );
    }

    // Extract return value from successful simulation
    if (
      rpc.Api.isSimulationSuccess(simResponse) &&
      simResponse.result
    ) {
      return scValToNative(simResponse.result.retval) as T;
    }

    throw createAppError(
      AppErrorType.SIMULATION,
      "Simulation returned no result"
    );
  } catch (err) {
    if (isAppError(err)) throw err;
    throw classifyError(err);
  }
}

// ── Error classification ──────────────────────────────────────────────────────

/**
 * Extract a useful error message from various error types.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    // AppError shape
    if ("message" in err && typeof (err as { message: unknown }).message === "string") {
      const msg = (err as { message: string }).message;
      const details = "details" in err ? (err as { details: string }).details : "";
      return details ? `${msg}: ${details}` : msg;
    }
    // Try JSON stringification for unknown objects
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/**
 * Extract error info from a sendTransaction ERROR response.
 */
function extractSendError(response: rpc.Api.SendTransactionResponse): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = response as any;
    if (resp.errorResult) {
      return `Error result: ${JSON.stringify(resp.errorResult)}`;
    }
    if (resp.errorResultXdr) {
      return `Error XDR: ${resp.errorResultXdr}`;
    }
    if (resp.diagnosticEventsXdr && resp.diagnosticEventsXdr.length > 0) {
      return `Diagnostic events: ${resp.diagnosticEventsXdr.length} event(s)`;
    }
  } catch {
    // ignore parse errors
  }
  return response.status;
}

/**
 * Extract error details from a failed on-chain transaction response.
 */
function extractOnChainError(response: rpc.Api.GetTransactionResponse): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = response as any;
    if (resp.resultXdr) {
      const result = resp.resultXdr;
      if (typeof result === "object" && result.result) {
        return `On-chain error: ${JSON.stringify(result.result())}`;
      }
      return `Result XDR present — check Stellar explorer for details`;
    }
  } catch {
    // ignore parse errors
  }
  return "Unknown on-chain error — check Stellar explorer for details";
}

function classifyError(err: unknown): AppError {
  const message = extractErrorMessage(err);
  const lower = message.toLowerCase();

  // Insufficient XLM — the native token SAC traps with Error(Contract, #10)
  // and "resulting balance is not within the allowed range" when the transfer
  // would push the account below its locked minimum reserve. Check this FIRST
  // (before the generic contract/simulation branches) so users get a clear,
  // actionable message instead of a raw HostError.
  if (
    lower.includes("allowed range") ||
    lower.includes("balance is not within") ||
    (lower.includes("#10") && lower.includes("transfer")) ||
    lower.includes("insufficient balance") ||
    lower.includes("underfunded")
  ) {
    return createAppError(
      AppErrorType.CONTRACT,
      "Insufficient XLM balance",
      "Your wallet doesn't have enough free XLM for this bet. Stellar keeps ~1 XLM locked as the account reserve, plus a small network fee. Try a smaller amount or top up your wallet."
    );
  }

  // Network errors
  if (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout") ||
    lower.includes("aborted")
  ) {
    return createAppError(
      AppErrorType.NETWORK,
      "Network request failed — check your connection",
      message
    );
  }

  // Wallet / signing errors
  if (
    lower.includes("rejected") ||
    lower.includes("denied") ||
    lower.includes("cancelled") ||
    lower.includes("wallet") ||
    lower.includes("sign")
  ) {
    return createAppError(
      AppErrorType.WALLET,
      "Wallet operation cancelled",
      message
    );
  }

  // Simulation errors
  if (
    lower.includes("simulation") ||
    lower.includes("host invocation failed") ||
    lower.includes("contract execution") ||
    lower.includes("restore")
  ) {
    return createAppError(
      AppErrorType.SIMULATION,
      "Contract simulation failed — the contract may have rejected this action",
      message
    );
  }

  // Contract errors (on-chain failures)
  if (
    lower.includes("contract") ||
    lower.includes("invoke") ||
    lower.includes("wasm")
  ) {
    return createAppError(
      AppErrorType.CONTRACT,
      "Contract call failed",
      message
    );
  }

  // Default: show the actual error instead of a generic message
  return createAppError(AppErrorType.NETWORK, message || "Transaction failed", message);
}

function createAppError(
  type: AppErrorType,
  message: string,
  details?: string
): AppError {
  return { type, message, details };
}

function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    "message" in err
  );
}
