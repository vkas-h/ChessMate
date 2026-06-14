import React, { useMemo, useState } from "react";
import { Share2, X, Check } from "lucide-react";

import renderStateTree from "@/lib/stateTree/render";

import { useAppStore } from "../store";

function ShareDialog(props: { onClose: () => void }) {
    const game = useAppStore(state => state.game);
    const currentNode = useAppStore(state => state.currentNode);

    const [copied, setCopied] = useState<"fen" | "pgn" | null>(null);

    const pgn = useMemo(() => {
        try {
            return renderStateTree(game.stateTree, game);
        } catch {
            return game.pgn;
        }
    }, [game]);

    async function copy(text: string, which: "fen" | "pgn") {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(which);
            setTimeout(() => setCopied(null), 1500);
        } catch {
            // Clipboard may be unavailable; the textarea is selectable
        }
    }

    return <div
        onClick={props.onClose}
        style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center"
        }}
    >
        <div
            onClick={event => event.stopPropagation()}
            style={{
                width: "100%",
                maxWidth: 560,
                background: "var(--surface-1)",
                borderRadius: "18px 18px 0 0",
                border: "1px solid var(--line)",
                padding: "18px 16px calc(18px + env(safe-area-inset-bottom))"
            }}
        >
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                }}>
                    <Share2 size={17} style={{ color: "var(--accent)" }} />
                    Share / Export
                </h3>

                <button
                    onClick={props.onClose}
                    style={{
                        color: "var(--text-faint)",
                        padding: 6,
                        display: "flex"
                    }}
                >
                    <X size={18} />
                </button>
            </div>

            <label style={labelStyle}>
                FEN (current position)
                <button
                    onClick={() => void copy(currentNode.state.fen, "fen")}
                    style={copyButtonStyle(copied == "fen")}
                >
                    {copied == "fen" ? "Copied" : "Copy"}
                </button>
            </label>

            <input
                readOnly
                value={currentNode.state.fen}
                onClick={event => event.currentTarget.select()}
                style={{
                    ...fieldStyle,
                    height: 40
                }}
            />

            <label style={{ ...labelStyle, marginTop: 14 }}>
                PGN (with your variations)
                <button
                    onClick={() => void copy(pgn, "pgn")}
                    style={copyButtonStyle(copied == "pgn")}
                >
                    {copied == "pgn" ? "Copied" : "Copy"}
                </button>
            </label>

            <textarea
                readOnly
                value={pgn}
                onClick={event => event.currentTarget.select()}
                style={{
                    ...fieldStyle,
                    height: 140,
                    resize: "none"
                }}
            />
        </div>
    </div>;
}

const labelStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "var(--text-dim)",
    marginBottom: 6
};

const fieldStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--text)",
    padding: "9px 10px",
    fontSize: "0.78rem",
    fontFamily: "monospace",
    outline: "none"
};

function copyButtonStyle(active: boolean): React.CSSProperties {
    return {
        padding: "4px 12px",
        borderRadius: 8,
        fontSize: "0.78rem",
        fontWeight: 700,
        background: active ? "var(--good)" : "var(--surface-2)",
        color: active ? "#141318" : "var(--text)",
        border: "1px solid var(--line)",
        transition: "background 0.15s"
    };
}

export default ShareDialog;
