import { get, set, del, keys } from "idb-keyval";

import AnalysedGame from "@/types/game/AnalysedGame";
import {
    serializeNode,
    deserializeNode,
    SerializedStateTreeNode
} from "@/types/game/position/StateTreeNode";
import { cloneDeep } from "lodash-es";

const GAME_PREFIX = "game:";
const SUMMARY_PREFIX = "gamesum:";

export interface SavedGameRecord {
    id: string;
    savedAt: string;
    /** content fingerprint for duplicate detection */
    hash: string;
    game: Omit<AnalysedGame, "stateTree"> & {
        stateTree: SerializedStateTreeNode;
    };
    accuracies?: { white: number; black: number };
}

export interface SavedGameSummary {
    id: string;
    savedAt: string;
    hash: string;
    white: string;
    black: string;
    whiteResult: string;
    accuracies?: { white: number; black: number };
    date?: string;
}

export class StorageQuotaError extends Error {
    constructor() {
        super("Device storage is full — free up space and try again.");
        this.name = "StorageQuotaError";
    }
}

function isQuotaError(error: unknown): boolean {
    return (
        error instanceof DOMException
        && (error.name == "QuotaExceededError"
            || error.name == "NS_ERROR_DOM_QUOTA_REACHED")
    );
}

/** Stable fingerprint of a game (players + date + PGN) for dedupe. */
function gameHash(game: AnalysedGame): string {
    const raw = [
        game.players.white.username,
        game.players.black.username,
        game.date || "",
        game.pgn
    ].join("|");

    // Lightweight 32-bit FNV-1a — collisions are irrelevant here.
    let hash = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
        hash ^= raw.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}

function buildSummary(record: SavedGameRecord): SavedGameSummary {
    return {
        id: record.id,
        savedAt: record.savedAt,
        hash: record.hash,
        white: record.game.players.white.username || "White",
        black: record.game.players.black.username || "Black",
        whiteResult: record.game.players.white.result,
        accuracies: record.accuracies,
        date: record.game.date
    };
}

/**
 * Save (or update) an analysed game on the device (IndexedDB).
 *
 * - If the same game is already saved (matching content hash), the
 *   existing record is UPDATED in place instead of creating a duplicate.
 * - A lightweight summary record is written alongside the full one so
 *   the Library list never has to deserialise every full game tree.
 *
 * @returns the id of the saved/updated record.
 * @throws StorageQuotaError when the device is out of space.
 */
export async function saveGame(
    game: AnalysedGame,
    accuracies?: { white: number; black: number },
    existingId?: string
): Promise<string> {
    const hash = gameHash(game);

    // Reuse an existing record id (explicit, or by matching hash).
    let id = existingId;
    if (!id) {
        const dup = (await listGames()).find(s => s.hash == hash);
        id = dup?.id;
    }
    id ??= crypto.randomUUID();

    // serializeNode mutates; work on a deep copy
    const treeCopy = cloneDeep(game.stateTree);

    const record: SavedGameRecord = {
        id,
        savedAt: new Date().toISOString(),
        hash,
        game: {
            ...game,
            stateTree: serializeNode(treeCopy) as SerializedStateTreeNode
        },
        accuracies
    };

    try {
        // serializeNode already strips parent links + trims engine
        // lines, so the record is plain-cloneable — no JSON round-trip.
        await set(GAME_PREFIX + id, record);
        await set(SUMMARY_PREFIX + id, buildSummary(record));
    } catch (error) {
        if (isQuotaError(error)) throw new StorageQuotaError();
        throw error;
    }

    return id;
}

/**
 * List summaries of all saved games, newest first. Reads the small
 * summary records only — O(number of games), not O(total data).
 */
export async function listGames(): Promise<SavedGameSummary[]> {
    const allKeys = (await keys()).filter(
        key => typeof key == "string" && key.startsWith(SUMMARY_PREFIX)
    );

    const summaries: SavedGameSummary[] = [];

    for (const key of allKeys) {
        try {
            const summary = await get<SavedGameSummary>(key);
            if (summary?.white) summaries.push(summary);
        } catch { /* skip corrupt */ }
    }

    // Back-compat: migrate any pre-summary records on the fly.
    if (summaries.length == 0) {
        const legacy = await migrateLegacySummaries();
        summaries.push(...legacy);
    }

    return summaries.sort(
        (a, b) => b.savedAt.localeCompare(a.savedAt)
    );
}

/** Build + persist summaries for records saved before summaries existed. */
async function migrateLegacySummaries(): Promise<SavedGameSummary[]> {
    const gameKeys = (await keys()).filter(
        key => typeof key == "string" && key.startsWith(GAME_PREFIX)
    );

    const summaries: SavedGameSummary[] = [];

    for (const key of gameKeys) {
        try {
            const record = await get<SavedGameRecord>(key);
            if (!record?.game?.players?.white) continue;

            // tolerate records that predate the hash field
            record.hash ??= "";
            const summary = buildSummary(record);
            await set(SUMMARY_PREFIX + record.id, summary);
            summaries.push(summary);
        } catch { /* skip */ }
    }

    return summaries;
}

/** Load a saved game, restoring the state tree's parent links. */
export async function loadGame(id: string) {
    const record = await get<SavedGameRecord>(GAME_PREFIX + id);
    if (!record) return undefined;

    const game: AnalysedGame = {
        ...record.game,
        stateTree: deserializeNode(record.game.stateTree)
    };

    return { game, accuracies: record.accuracies };
}

export async function deleteGame(id: string) {
    await del(GAME_PREFIX + id);
    await del(SUMMARY_PREFIX + id);
}
