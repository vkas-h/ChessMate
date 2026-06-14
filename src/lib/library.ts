import { get, set, del, keys } from "idb-keyval";

import AnalysedGame from "@/types/game/AnalysedGame";
import {
    serializeNode,
    deserializeNode,
    SerializedStateTreeNode
} from "@/types/game/position/StateTreeNode";
import { cloneDeep } from "lodash-es";

const GAME_PREFIX = "game:";

export interface SavedGameRecord {
    id: string;
    savedAt: string;
    game: Omit<AnalysedGame, "stateTree"> & {
        stateTree: SerializedStateTreeNode;
    };
    accuracies?: { white: number; black: number };
}

export interface SavedGameSummary {
    id: string;
    savedAt: string;
    white: string;
    black: string;
    whiteResult: string;
    accuracies?: { white: number; black: number };
    date?: string;
}

/** Save an analysed game to the device (IndexedDB). */
export async function saveGame(
    game: AnalysedGame,
    accuracies?: { white: number; black: number }
) {
    const id = crypto.randomUUID();

    // serializeNode mutates; work on a deep copy
    const treeCopy = cloneDeep(game.stateTree);

    const record: SavedGameRecord = {
        id,
        savedAt: new Date().toISOString(),
        game: {
            ...game,
            stateTree: serializeNode(treeCopy) as SerializedStateTreeNode
        },
        accuracies
    };

    await set(GAME_PREFIX + id, JSON.parse(JSON.stringify(record)));

    return id;
}

/** List summaries of all saved games, newest first. */
export async function listGames(): Promise<SavedGameSummary[]> {
    const allKeys = (await keys()).filter(
        key => typeof key == "string" && key.startsWith(GAME_PREFIX)
    );

    const summaries: SavedGameSummary[] = [];

    for (const key of allKeys) {
        let record: SavedGameRecord | undefined;

        try {
            record = await get(key);
        } catch {
            continue;
        }

        if (!record?.game?.players?.white) continue;

        summaries.push({
            id: record.id,
            savedAt: record.savedAt,
            white: record.game.players.white.username || "White",
            black: record.game.players.black.username || "Black",
            whiteResult: record.game.players.white.result,
            accuracies: record.accuracies,
            date: record.game.date
        });
    }

    return summaries.sort(
        (a, b) => b.savedAt.localeCompare(a.savedAt)
    );
}

/** Load a saved game, restoring the state tree's parent links. */
export async function loadGame(id: string) {
    const record: SavedGameRecord | undefined = await get(GAME_PREFIX + id);
    if (!record) return undefined;

    const game: AnalysedGame = {
        ...record.game,
        stateTree: deserializeNode(record.game.stateTree)
    };

    return { game, accuracies: record.accuracies };
}

export async function deleteGame(id: string) {
    await del(GAME_PREFIX + id);
}
