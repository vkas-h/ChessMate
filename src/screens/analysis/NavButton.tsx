import React from "react";

function NavButton(props: {
    icon: React.ReactNode;
    onClick: () => void;
    grow?: boolean;
    label?: string;
    disabled?: boolean;
}) {
    return <button
        onClick={props.disabled ? undefined : props.onClick}
        aria-label={props.label}
        title={props.label}
        disabled={props.disabled}
        style={{
            flex: props.grow ? 2 : 1,
            minHeight: 44,
            padding: "11px 0",
            borderRadius: "var(--r-sm)",
            background: "var(--surface-2)",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: props.disabled ? 0.38 : 1,
            cursor: props.disabled ? "not-allowed" : "pointer"
        }}
    >
        {props.icon}
    </button>;
}

export default NavButton;
