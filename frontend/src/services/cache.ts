const CACHE_PREFIX = "ip_";
const DEFAULT_TTL = 30_000; // 30 seconds

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// ── Two-tier cache ──────────────────────────────────────────────────────────
// Tier 1: in-memory Map — instant, survives client-side navigation (SPA), no
//         JSON parse cost. This is what makes returning to a page feel instant.
// Tier 2: localStorage — survives full page reloads / new tabs.
//
// Reads check memory first (synchronous, microseconds), then fall back to
// localStorage (re-hydrating memory). Writes update both.
const memory = new Map<string, CacheEntry<unknown>>();

/** Get a cached value. Returns null if expired or not found. */
export function get<T>(key: string): T | null {
  // Tier 1: in-memory (fastest)
  const mem = memory.get(key);
  if (mem) {
    if (Date.now() <= mem.expiry) return mem.data as T;
    memory.delete(key);
  }

  // Tier 2: localStorage (re-hydrates memory on hit)
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiry) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    memory.set(key, entry); // re-hydrate tier 1
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Get a value even if expired (stale). Used for stale-while-revalidate:
 * show stale data instantly, refresh in the background.
 */
export function getStale<T>(key: string): T | null {
  const mem = memory.get(key);
  if (mem) return mem.data as T;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    memory.set(key, entry);
    return entry.data;
  } catch {
    return null;
  }
}

/** Set a cached value with optional TTL in milliseconds. */
export function set<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  const entry: CacheEntry<T> = { data, expiry: Date.now() + ttl };
  memory.set(key, entry); // tier 1 — always available, even SSR
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage might be full — memory cache still works, silently fail
  }
}

/** Invalidate a specific cache key (both tiers). */
export function invalidate(key: string): void {
  memory.delete(key);
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_PREFIX + key);
}

/** Invalidate all StellarPulse cache entries (both tiers). */
export function invalidateAll(): void {
  memory.clear();
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
