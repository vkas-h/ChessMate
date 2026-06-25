import GameResult, {
    getOpinionatedGameResult
} from "@/constants/game/GameResult";
import PieceColour from "@/constants/PieceColour";

import { SavedGameSummary } from "./library";

export interface WinDrawLoss {
    win: number;
    draw: number;
    loss: number;
    total: number;
}

export interface OpeningStat {
    name: string;
    wdl: WinDrawLoss;
}

export interface PlayerStats {
    /** how many saved games involve this user */
    games: number;
    overall: WinDrawLoss;
    asWhite: WinDrawLoss;
    asBlack: WinDrawLoss;

    /** average of the user's own accuracy across analysed games (or NaN) */
    avgAccuracy: number;
    avgAccuracyWhite: number;
    avgAccuracyBlack: number;
    bestAccuracy?: { value: number; summary: SavedGameSummary };
    worstAccuracy?: { value: number; summary: SavedGameSummary };

    byTimeControl: { name: string; wdl: WinDrawLoss }[];
    topOpenings: OpeningStat[];
}

function emptyWDL(): WinDrawLoss {
    return { win: 0, draw: 0, loss: 0, total: 0 };
}

function addResult(wdl: WinDrawLoss, result: GameResult) {
    if (result == GameResult.WIN) wdl.win++;
    else if (result == GameResult.LOSE) wdl.loss++;
    else if (result == GameResult.DRAW) wdl.draw++;
    else return; // unknown: don't count toward total
    wdl.total++;
}

export function winRate(wdl: WinDrawLoss): number {
    if (wdl.total == 0) return NaN;
    // score-based: win=1, draw=0.5
    return ((wdl.win + wdl.draw * 0.5) / wdl.total) * 100;
}

function lc(s?: string) {
    return (s || "").trim().toLowerCase();
}

/**
 * Aggregate stats for a given username from the saved-game summaries.
 * Games where neither player matches the username are skipped (so the
 * stats are always "your" perspective). If username is empty, we still
 * produce overall stats from White's perspective as a fallback.
 */
export function computePlayerStats(
    summaries: SavedGameSummary[],
    username: string
): PlayerStats {
    const user = lc(username);

    const overall = emptyWDL();
    const asWhite = emptyWDL();
    const asBlack = emptyWDL();

    const accuracies: number[] = [];
    const accWhite: number[] = [];
    const accBlack: number[] = [];

    let best: PlayerStats["bestAccuracy"];
    let worst: PlayerStats["worstAccuracy"];

    const tcMap = new Map<string, WinDrawLoss>();
    const openingMap = new Map<string, WinDrawLoss>();

    let games = 0;

    for (const s of summaries) {
        const isWhite = user
            ? lc(s.white) == user
            : true; // fallback: treat as white's perspective
        const isBlack = user ? lc(s.black) == user : false;

        // Skip games that don't involve the user (when we know the user).
        if (user && !isWhite && !isBlack) continue;

        games++;

        const colour = isWhite ? PieceColour.WHITE : PieceColour.BLACK;
        const myResult = getOpinionatedGameResult(
            s.whiteResult as GameResult, colour
        );

        addResult(overall, myResult);
        addResult(colour == PieceColour.WHITE ? asWhite : asBlack, myResult);

        // accuracy (the user's own side)
        const myAcc = s.accuracies
            ? (colour == PieceColour.WHITE
                ? s.accuracies.white : s.accuracies.black)
            : undefined;

        if (myAcc != undefined && !isNaN(myAcc)) {
            accuracies.push(myAcc);
            (colour == PieceColour.WHITE ? accWhite : accBlack).push(myAcc);

            if (!best || myAcc > best.value) best = { value: myAcc, summary: s };
            if (!worst || myAcc < worst.value) worst = { value: myAcc, summary: s };
        }

        // time control
        const tc = s.timeControl || "Other";
        if (!tcMap.has(tc)) tcMap.set(tc, emptyWDL());
        addResult(tcMap.get(tc)!, myResult);

        // opening
        if (s.opening) {
            if (!openingMap.has(s.opening)) openingMap.set(s.opening, emptyWDL());
            addResult(openingMap.get(s.opening)!, myResult);
        }
    }

    const mean = (xs: number[]) =>
        xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

    const byTimeControl = [...tcMap.entries()]
        .map(([name, wdl]) => ({ name, wdl }))
        .sort((a, b) => b.wdl.total - a.wdl.total);

    const topOpenings = [...openingMap.entries()]
        .map(([name, wdl]) => ({ name, wdl }))
        .sort((a, b) => b.wdl.total - a.wdl.total)
        .slice(0, 6);

    return {
        games,
        overall,
        asWhite,
        asBlack,
        avgAccuracy: mean(accuracies),
        avgAccuracyWhite: mean(accWhite),
        avgAccuracyBlack: mean(accBlack),
        bestAccuracy: best,
        worstAccuracy: worst,
        byTimeControl,
        topOpenings
    };
}
