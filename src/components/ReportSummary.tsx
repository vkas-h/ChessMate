import React from "react";
import { BarChart3 } from "lucide-react";

import { Classification } from "@/constants/Classification";

import {
    classificationColours,
    classificationIcon,
    classificationNames
} from "../lib/classifications";
import { accuracyDescriptor } from "../lib/report";

function ReportSummary(props: {
    accuracies?: { white: number; black: number };
    counts: Record<string, { white: number; black: number }>;
    order: Classification[];
    /** Tap a classification row to jump to that kind of move. */
    onJumpToClassification?: (classif: Classification) => void;
}) {
    const maxCount = Math.max(
        1,
        ...props.order.map(classif => {
            const count = props.counts[classif];
            return count ? Math.max(count.white, count.black) : 0;
        })
    );

    return <div style={{
        background: "var(--surface-1)",
        borderRadius: "var(--r-lg)",
        padding: "16px 16px 10px"
    }}>
        <h3 style={{
            margin: "0 0 14px",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: "var(--text-dim)",
            display: "flex",
            alignItems: "center",
            gap: 7
        }}>
            <BarChart3 size={15} /> MOVE QUALITY
        </h3>

        {/* accuracy stat blocks */}
        {props.accuracies && <div style={{
            display: "flex",
            gap: 10,
            marginBottom: 14
        }}>
            <AccuracyBlock
                label="White"
                value={props.accuracies.white}
                light
            />
            <AccuracyBlock
                label="Black"
                value={props.accuracies.black}
            />
        </div>}

        {/* classification rows with micro bars (tappable) */}
        {props.order.map(classif => {
            const count = props.counts[classif];
            if (!count || (count.white == 0 && count.black == 0))
                return null;

            const colour = classificationColours[classif];

            return <button
                key={classif}
                onClick={() => props.onJumpToClassification?.(classif)}
                aria-label={`Jump to first ${classificationNames[classif]} move`}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    padding: "6px 6px",
                    gap: 10,
                    background: "transparent",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer"
                }}
            >
                <div style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8
                }}>
                    <div style={{
                        height: 4,
                        width: `${(count.white / maxCount) * 70}%`,
                        background: count.white > 0 ? colour : "transparent",
                        borderRadius: 2,
                        opacity: 0.55
                    }} />
                    <span style={{
                        width: 18,
                        textAlign: "right",
                        fontWeight: 800,
                        fontSize: 14,
                        color: count.white > 0
                            ? "var(--text)" : "var(--text-faint)"
                    }}>
                        {count.white}
                    </span>
                </div>

                <span style={{
                    width: 110,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    color: colour,
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0
                }}>
                    <img
                        src={classificationIcon(classif)}
                        style={{ width: 15, height: 15 }}
                    />
                    {classificationNames[classif]}
                </span>

                <div style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                }}>
                    <span style={{
                        width: 18,
                        fontWeight: 800,
                        fontSize: 14,
                        color: count.black > 0
                            ? "var(--text)" : "var(--text-faint)"
                    }}>
                        {count.black}
                    </span>
                    <div style={{
                        height: 4,
                        width: `${(count.black / maxCount) * 70}%`,
                        background: count.black > 0 ? colour : "transparent",
                        borderRadius: 2,
                        opacity: 0.55
                    }} />
                </div>
            </button>;
        })}
    </div>;
}

function AccuracyBlock(props: {
    label: string;
    value: number;
    light?: boolean;
}) {
    const display = isNaN(props.value) ? "—" : props.value.toFixed(1);
    const descriptor = accuracyDescriptor(props.value);

    return <div style={{
        flex: 1,
        background: props.light ? "#f5f5f7" : "var(--surface-2)",
        color: props.light ? "#1a1a1b" : "var(--text)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
        textAlign: "center"
    }}>
        <div style={{
            fontSize: 24,
            fontWeight: 800,
            lineHeight: 1.1,
            fontFamily: "ui-monospace, monospace"
        }}>
            {display}
            <span style={{ fontSize: 13, fontWeight: 700 }}>%</span>
        </div>
        <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            opacity: 0.65,
            marginTop: 2
        }}>
            {props.label.toUpperCase()} ACCURACY
        </div>
        <div style={{
            fontSize: 11,
            fontWeight: 800,
            marginTop: 4,
            color: props.light ? descriptor.colour : descriptor.colour
        }}>
            {descriptor.label}
        </div>
    </div>;
}

export default ReportSummary;
