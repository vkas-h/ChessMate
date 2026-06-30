import React from "react";

function NavButton(props: {
    icon: React.ReactNode;
    onClick: () => void;
    grow?: boolean;
    label?: string;
}) {
    return <button
        onClick={props.onClick}
        aria-label={props.label}
        title={props.label}
        style={{
            flex: props.grow ? 2 : 1,
            padding: "11px 0",
            borderRadius: "var(--r-sm)",
            background: "var(--surface-2)",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        }}
    >
        {props.icon}
    </button>;
}

export default NavButton;
