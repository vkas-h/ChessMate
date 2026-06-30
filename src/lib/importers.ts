import { validateFen } from "chess.js";
import { parseGame } from "@mliebelt/pgn-parser";

import Game from "@/types/game/Game";
import GameResult from "@/constants/game/GameResult";
import PieceColour from "@/constants/PieceColour";
import TimeControl from "@/constants/game/TimeControl";
import Variant from "@/constants/game/Variant";
import { STARTING_FEN } from "@/constants/utils";
import { padDateNumber, getMonthLength } from "@/lib/utils/date";

export type ImportErrorCode = "not_found" | "network" | "rate_limited" | "server";

export class ImportError extends Error {
    constructor(public code: ImportErrorCode, message: string) {
        super(message);
        this.name = "ImportError";
    }
}

function importError(platform: string, response: Response): ImportError {
    if (response.status == 404) {
        return new ImportError("not_found", `${platform} user not found.`);
    }
    if (response.status == 429) {
        return new ImportError(
            "rate_limited",
            `${platform} is rate-limiting requests. Try again in a minute.`
        );
    }
    if (response.status >= 500) {
        return new ImportError(
            "server",
            `${platform} is temporarily unavailable. Try again later.`
        );
    }
    return new ImportError(
        "network",
        `${platform} returned an error (${response.status}).`
    );
}

/* ---------------------------------- PGN ---------------------------------- */

function parseResultString(result: string, colour: PieceColour) {
    if (result == "1/2-1/2") return GameResult.DRAW;
    if (result == "*") return GameResult.UNKNOWN;

    const winningResult = colour == PieceColour.WHITE ? "1-0" : "0-1";
    return result == winningResult ? GameResult.WIN : GameResult.LOSE;
}

export function parsePgn(pgn: string): Game {
    const sanitisedPGN = pgn.trim().replace(/("])\n(\d+\.)/, "$1\n\n$2");

    const game = parseGame(sanitisedPGN);
    const headers = (game.tags || {}) as any;

    const variant = headers["Variant"] == "Chess960"
        ? Variant.CHESS960 : Variant.STANDARD;

    const initialPosition = (headers["FEN"] && validateFen(headers["FEN"]).ok)
        ? headers["FEN"] : STARTING_FEN;

    const ratings = {
        white: parseInt(headers["WhiteElo"] || ""),
        black: parseInt(headers["BlackElo"] || "")
    };

    return {
        pgn: sanitisedPGN,
        players: {
            white: {
                username: headers["White"] || "White",
                title: headers["WhiteTitle"],
                rating: isNaN(ratings.white) ? undefined : ratings.white,
                result: parseResultString(
                    headers["Result"] || "*", PieceColour.WHITE
                )
            },
            black: {
                username: headers["Black"] || "Black",
                title: headers["BlackTitle"],
                rating: isNaN(ratings.black) ? undefined : ratings.black,
                result: parseResultString(
                    headers["Result"] || "*", PieceColour.BLACK
                )
            }
        },
        variant,
        initialPosition
    };
}

/* -------------------------------- Chess.com ------------------------------- */

const chessComTimeControls: Record<string, TimeControl | undefined> = {
    bullet: TimeControl.BULLET,
    blitz: TimeControl.BLITZ,
    rapid: TimeControl.RAPID,
    daily: TimeControl.CORRESPONDENCE
};

const chessComVariants: Record<string, Variant | undefined> = {
    chess: Variant.STANDARD,
    chess960: Variant.CHESS960
};

const chessComResults: Record<string, GameResult | undefined> = {
    win: GameResult.WIN,
    checkmated: GameResult.LOSE,
    agreed: GameResult.DRAW,
    repetition: GameResult.DRAW,
    timeout: GameResult.LOSE,
    resigned: GameResult.LOSE,
    stalemate: GameResult.DRAW,
    lose: GameResult.LOSE,
    insufficient: GameResult.DRAW,
    "50move": GameResult.DRAW,
    abandoned: GameResult.LOSE,
    timevsinsufficient: GameResult.DRAW
};

function mapChessComGame(game: any): Game {
    return {
        pgn: game.pgn,
        timeControl: chessComTimeControls[game["time_class"]]
            || TimeControl.CORRESPONDENCE,
        variant: chessComVariants[game.rules] || Variant.STANDARD,
        initialPosition: game["initial_setup"] || STARTING_FEN,
        players: {
            white: {
                username: game.white.username,
                rating: game.white.rating,
                result: chessComResults[game.white.result]
                    || GameResult.UNKNOWN
            },
            black: {
                username: game.black.username,
                rating: game.black.rating,
                result: chessComResults[game.black.result]
                    || GameResult.UNKNOWN
            }
        },
        date: new Date(game["end_time"] * 1000).toISOString()
    };
}

export async function getChessComGames(
    username: string,
    month: number,
    year: number
): Promise<Game[]> {
    const response = await fetch(
        `https://api.chess.com/pub/player/${username}`
        + `/games/${year}/${padDateNumber(month)}`
    );

    if (response.status == 404) return [];
    if (!response.ok) throw importError("Chess.com", response);

    const games: any[] = (await response.json()).games || [];

    return games
        .reverse()
        .filter(game => Object.keys(chessComVariants).includes(game.rules))
        .map(mapChessComGame);
}

export async function getRecentChessComGames(
    username: string,
    maxGames = 50
): Promise<Game[]> {
    const archivesResponse = await fetch(
        `https://api.chess.com/pub/player/${username}/games/archives`
    );

    if (!archivesResponse.ok) throw importError("Chess.com", archivesResponse);

    const archives: string[] = (await archivesResponse.json()).archives || [];
    const recentArchives = archives.slice(-6).reverse();
    const collected: Game[] = [];

    for (const archiveUrl of recentArchives) {
        if (collected.length >= maxGames) break;

        const response = await fetch(archiveUrl);
        if (!response.ok) continue;

        const games: any[] = (await response.json()).games || [];
        collected.push(
            ...games
                .reverse()
                .filter(game => Object.keys(chessComVariants).includes(game.rules))
                .map(mapChessComGame)
        );
    }

    return collected.slice(0, maxGames);
}

/* --------------------------------- Lichess -------------------------------- */

const lichessTimeControls: Record<string, TimeControl | undefined> = {
    ultraBullet: TimeControl.BULLET,
    bullet: TimeControl.BULLET,
    blitz: TimeControl.BLITZ,
    rapid: TimeControl.RAPID,
    classical: TimeControl.CLASSICAL,
    correspondence: TimeControl.CORRESPONDENCE
};

const lichessVariants: Record<string, Variant | undefined> = {
    standard: Variant.STANDARD,
    chess960: Variant.CHESS960
};

function mapLichessGame(game: any): Game {
    const results = {
        [PieceColour.WHITE]: GameResult.DRAW,
        [PieceColour.BLACK]: GameResult.DRAW
    };

    if (game.winner == "white") {
        results[PieceColour.WHITE] = GameResult.WIN;
        results[PieceColour.BLACK] = GameResult.LOSE;
    } else if (game.winner == "black") {
        results[PieceColour.BLACK] = GameResult.WIN;
        results[PieceColour.WHITE] = GameResult.LOSE;
    }

    const whiteUsername = game.players.white.aiLevel
        ? `Stockfish ${game.players.white.aiLevel}`
        : game.players.white.user?.name;

    const blackUsername = game.players.black.aiLevel
        ? `Stockfish ${game.players.black.aiLevel}`
        : game.players.black.user?.name;

    return {
        pgn: game.pgn,
        initialPosition: game.initialFen || STARTING_FEN,
        timeControl: lichessTimeControls[game.speed]
            || TimeControl.CORRESPONDENCE,
        variant: lichessVariants[game.variant] || Variant.STANDARD,
        players: {
            white: {
                username: whiteUsername,
                rating: game.players.white.rating,
                title: game.players.white.user?.title,
                result: results[PieceColour.WHITE]
            },
            black: {
                username: blackUsername,
                rating: game.players.black.rating,
                title: game.players.black.user?.title,
                result: results[PieceColour.BLACK]
            }
        },
        date: new Date(game.lastMoveAt).toISOString()
    } as Game;
}

async function fetchLichessNdjson(url: string): Promise<Game[]> {
    const response = await fetch(url, {
        headers: { Accept: "application/x-ndjson" }
    });

    if (!response.ok) throw importError("Lichess", response);

    return (await response.text())
        .split("\n")
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line))
        .map(mapLichessGame);
}

export async function getLichessGames(
    username: string,
    month: number,
    year: number
): Promise<Game[]> {
    const monthStart = new Date(
        `${year}-${padDateNumber(month)}-01T00:00:00.000Z`
    );
    const monthEnd = new Date(
        `${year}-${padDateNumber(month)}-${getMonthLength(month)}`
        + "T23:59:59.999Z"
    );

    return fetchLichessNdjson(
        `https://lichess.org/api/games/user/${username}`
        + `?since=${monthStart.getTime()}`
        + `&until=${monthEnd.getTime()}`
        + "&pgnInJson=true&max=50"
    );
}

export async function getRecentLichessGames(
    username: string,
    maxGames = 50
): Promise<Game[]> {
    return fetchLichessNdjson(
        `https://lichess.org/api/games/user/${username}`
        + `?pgnInJson=true&max=${maxGames}`
    );
}
