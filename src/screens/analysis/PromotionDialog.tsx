import { useEffect, useRef } from "react";

const PROMO_GLYPHS: Record<string, Record<string, string>> = {
    w: { q: "♕", r: "♖", b: "♗", n: "♘" },
    b: { q: "♛", r: "♜", b: "♝", n: "♞" }
};

function PromotionDialog(props: {
    colour: "w" | "b";
    onPick: (piece: "q" | "r" | "b" | "n") => void;
    onCancel: () => void;
}) {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const pieces: ("q" | "r" | "b" | "n")[] = ["q", "r", "b", "n"];

    useEffect(() => {
        dialogRef.current?.focus();

        function onKey(event: KeyboardEvent) {
            if (event.key == "Escape") props.onCancel();
        }

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [props.onCancel]);

    return <div
        onClick={props.onCancel}
        style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        }}
    >
        <div
            ref={dialogRef}
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Choose promotion piece"
            tabIndex={-1}
            style={{
                background: "var(--surface-1)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-lg)",
                padding: 16,
                display: "flex",
                gap: 10,
                outline: "none"
            }}
        >
            {pieces.map(piece => <button
                key={piece}
                onClick={() => props.onPick(piece)}
                aria-label={{
                    q: "Promote to queen", r: "Promote to rook",
                    b: "Promote to bishop", n: "Promote to knight"
                }[piece]}
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    fontSize: 34,
                    lineHeight: 1,
                    color: "var(--text)",
                    cursor: "pointer"
                }}
            >
                {PROMO_GLYPHS[props.colour][piece]}
            </button>)}
        </div>
    </div>;
}

export default PromotionDialog;
