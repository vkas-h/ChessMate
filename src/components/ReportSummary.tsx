import React from "react";
import { BarChart3 } from "lucide-react";

import { Classification } from "@/constants/Classification";

import {
    classificationColours,
    classificationIcon,
    classificationNames
} from "../lib/classifications";

function ReportSummary(props: {
    accuracies?: { white: number; black: number };
    counts: Record<string, { white: number; black: number }>;
    order: Classification[];
}) {
    // For micro bar scaling
    const maxCount = Math.max(
        1,
        ...props.order.map(classif => {
            const count = props.counts[classif];
            return count ? Math.max(count.white, count.black) : 0;
        })
    );

    return <div style={{
        marginTop: 14,
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
            <BarChart3 size={15} /> GAME REPORT
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

        {/* classification rows with micro bars */}
        {props.order.map(classif => {
            const count = props.counts[classif];
            if (!count || (count.white == 0 && count.black == 0))
                return null;

            const colour = classificationColours[classif];

            return <div
                key={classif}
                style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "6px 0",
                    gap: 10
                }}
            >
                {/* white count + bar (grows leftward) */}
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
                        background: count.white > 0
                            ? colour : "transparent",
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

                {/* centre label */}
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

                {/* black count + bar (grows rightward) */}
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
                        background: count.black > 0
                            ? colour : "transparent",
                        borderRadius: 2,
                        opacity: 0.55
                    }} />
                </div>
            </div>;
        })}
    </div>;
}

function AccuracyBlock(props: {
    label: string;
    value: number;
    light?: boolean;
}) {
    const display = isNaN(props.value)
        ? "—" : props.value.toFixed(1);

    return <div style={{
        flex: 1,
        background: props.light ? "#ecebee" : "var(--surface-2)",
        color: props.light ? "#141318" : "var(--text)",
        borderRadius: "var(--r-md)",
        padding: "10px 14px",
        textAlign: "center"
    }}>
        <div style={{
            fontSize: 22,
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
    </div>;
}

export default ReportSummary;
