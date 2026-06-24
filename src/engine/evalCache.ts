import { get, set, keys, del } from "idb-keyval";

import { EngineLine } from "@/types/game/position/EngineLine";

/**
 * Persistent evaluation cache (FEN -> engine lines), so re-analysing a
 * game, or analysing games that share an opening, never recomputes a
 * position we've already seen. Backed by IndexedDB with a synchronous
 * in-memory layer for hot lookups during a single analysis run.
 *
 * This is the single biggest analysis-speed lever: opening positions
 * and transpositions become near-instant cache hits.
 */

const CACHE_PREFIX = "eval:";

/** Cap so the cache can't grow unbounded on heavy users. */
const MAX_ENTRIES = 5000;

interface CacheEntry {
    /** best depth we have stored for this FEN */
    depth: number;
    lines: EngineLine[];
    /** last access (ms) for LRU-ish pruning */
    touched: number;
}

const memory = new Map<string, CacheEntry>();
let hydrated = false;

/**
 * Normalise a FEN to its position-significant fields (piece placement,
 * side to move, castling, en-passant) and DROP the halfmove/fullmove
 * counters, so positions that are identical for engine purposes share a
 * cache slot regardless of move number.
 */
export function normaliseFen(fen: string): string {
    const parts = fen.trim().split(/\s+/);
    return parts.slice(0, 4).join(" ");
}

/** Load existing cache entries into memory once, lazily. */
export async function hydrateEvalCache(): Promise<void> {
    if (hydrated) return;
    hydrated = true;

    try {
        const allKeys = (await keys()).filter(
            key => typeof key == "string" && key.startsWith(CACHE_PREFIX)
        ) as string[];

        for (const key of allKeys) {
            try {
                const entry = await get<CacheEntry>(key);
                if (entry && Array.isArray(entry.lines)) {
                    memory.set(key.slice(CACHE_PREFIX.length), entry);
                }
            } catch { /* skip corrupt entry */ }
        }
    } catch { /* IndexedDB may be unavailable */ }
}

/**
 * Return cached lines for a FEN if we have them at >= minDepth.
 * Cloud lines (very deep) always qualify.
 */
export function getCachedLines(
    fen: string,
    minDepth: number
): EngineLine[] | undefined {
    const entry = memory.get(normaliseFen(fen));
    if (!entry) return undefined;
    if (entry.depth < minDepth) return undefined;

    entry.touched = Date.now();
    return entry.lines;
}

/** Store lines for a FEN, keeping the deepest set. Persists async. */
export function putCachedLines(fen: string, lines: EngineLine[]): void {
    if (!lines.length) return;

    const key = normaliseFen(fen);
    const depth = Math.max(...lines.map(line => line.depth));

    const existing = memory.get(key);
    if (existing && existing.depth >= depth) {
        existing.touched = Date.now();
        return;
    }

    const entry: CacheEntry = { depth, lines, touched: Date.now() };
    memory.set(key, entry);

    // fire-and-forget persistence
    void set(CACHE_PREFIX + key, entry).catch(() => { /* ignore */ });

    if (memory.size > MAX_ENTRIES) void pruneCache();
}

/** Drop the least-recently-used entries back down to the cap. */
async function pruneCache(): Promise<void> {
    const entries = [...memory.entries()]
        .sort((a, b) => a[1].touched - b[1].touched);

    const removeCount = memory.size - Math.floor(MAX_ENTRIES * 0.9);

    for (let i = 0; i < removeCount; i++) {
        const [key] = entries[i];
        memory.delete(key);
        void del(CACHE_PREFIX + key).catch(() => { /* ignore */ });
    }
}

/** Wipe the entire eval cache (settings / troubleshooting). */
export async function clearEvalCache(): Promise<void> {
    memory.clear();
    try {
        const allKeys = (await keys()).filter(
            key => typeof key == "string" && key.startsWith(CACHE_PREFIX)
        ) as string[];
        await Promise.all(allKeys.map(key => del(key)));
    } catch { /* ignore */ }
}
