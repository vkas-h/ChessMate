import { Move } from "chess.js";

const cache: Record<string, HTMLAudioElement> = {};

function play(name: string) {
    try {
        cache[name] ??= new Audio(`/audio/${name}.mp3`);
        cache[name].currentTime = 0;
        void cache[name].play();
    } catch {
        // Autoplay may be blocked; ignore
    }
}

export function playMoveSound(move: Move, isCheck: boolean) {
    if (isCheck) return play("check");
    if (move.isPromotion()) return play("promote");
    if (move.isKingsideCastle() || move.isQueensideCastle())
        return play("castle");
    if (move.isCapture() || move.isEnPassant()) return play("capture");

    play("move");
}

export function playGameEndSound() {
    play("gameend");
}
