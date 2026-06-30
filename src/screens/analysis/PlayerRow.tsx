function PlayerRow(props: {
    name: string;
    rating?: number;
    accuracy?: number;
}) {
    return <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "2px 2px"
    }}>
        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            {props.name}
        </span>

        {props.rating && <span style={{
            color: "var(--text-dim)",
            fontSize: "0.8rem"
        }}>
            ({props.rating})
        </span>}

        {props.accuracy != undefined && !isNaN(props.accuracy) && <span style={{
            marginLeft: "auto",
            background: "var(--surface-2)",
            color: "var(--text)",
            fontWeight: 800,
            fontSize: 12,
            borderRadius: 6,
            padding: "2px 8px",
            border: "1px solid var(--line-strong)"
        }}>
            {props.accuracy.toFixed(1)}%
        </span>}
    </div>;
}

export default PlayerRow;
