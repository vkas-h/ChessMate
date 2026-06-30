const PROMO_GLYPHS: Record<string, Record<string, string>> = {
    w: { q: "♕", r: "♖", b: "♗", n: "♘" },
    b: { q: "♛", r: "♜", b: "♝", n: "♞" }
};

function PromotionDialog(props: {
    colour: "w" | "b";
    onPick: (piece: "q" | "r" | "b" | "n") => void;
    onCancel: () => void;
}) {
    const pieces: ("q" | "r" | "b" | "n")[] = ["q", "r", "b", "n"];

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
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-label="Choose promotion piece"
            style={{
                background: "var(--surface-1)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-lg)",
                padding: 16,
                display: "flex",
                gap: 10
            }}
        >
            {pieces.map(piece => <button
                key={piece}
                onClick={() => props.onPick(piece)}
                aria-label={{
                    q: "Queen", r: "Rook", b: "Bishop", n: "Knight"
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
