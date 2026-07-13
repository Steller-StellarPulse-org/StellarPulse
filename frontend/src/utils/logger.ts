// ── Structured logging for contract calls ─────────────────────────────────────
//
// A tiny, dependency-free structured logger so failed contract calls are easy to
// find and parse in log pipelines. Each error log is a single JSON line carrying
// the contract id, method, (serialized) args, and the error message.

export interface ContractErrorLogInput {
  /** Contract id / address the call targeted. */
  contract: string;
  /** Method invoked on the contract. */
  method: string;
  /** Arguments passed to the method (best-effort serialized). */
  args?: unknown;
  /** The error that was thrown. */
  error: unknown;
}

export interface ContractErrorLog {
  level: "error";
  scope: "contract-call";
  contract: string;
  method: string;
  args: string;
  error: string;
  timestamp: string;
}

/** Best-effort JSON serialization that survives bigint and circular values. */
export function safeSerialize(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    const seen = new WeakSet();
    const out = JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    });
    return out ?? String(value);
  } catch {
    return String(value);
  }
}

/** Extract a human-readable message from any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/** Build the structured log object (pure — easy to unit test). */
export function buildContractErrorLog(input: ContractErrorLogInput): ContractErrorLog {
  return {
    level: "error",
    scope: "contract-call",
    contract: input.contract,
    method: input.method,
    args: safeSerialize(input.args),
    error: errorMessage(input.error),
    timestamp: new Date().toISOString(),
  };
}

/** Emit a structured single-line JSON error log for a failed contract call. */
export function logContractError(input: ContractErrorLogInput): void {
  // eslint-disable-next-line no-console -- intentional structured server log
  console.error(JSON.stringify(buildContractErrorLog(input)));
}
