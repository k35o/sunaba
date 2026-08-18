import { useState } from "react";
import type { ReactNode } from "react";

export type ButtonProps = {
  label: ReactNode;
  variant?: "primary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
};

const PADDINGS = { sm: "0.25rem 0.75rem", md: "0.5rem 1.25rem", lg: "0.75rem 2rem" };
const FONT_SIZES = { sm: "0.85rem", md: "1rem", lg: "1.15rem" };

export const Button = ({
  label,
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
}: ButtonProps): ReactNode => {
  const [count, setCount] = useState(0);
  const background =
    variant === "primary"
      ? "var(--accent)"
      : variant === "danger"
        ? "var(--danger)"
        : "transparent";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setCount((current) => current + 1);
        onClick?.();
      }}
      style={{
        background,
        color: variant === "ghost" ? "var(--fg)" : "var(--accent-fg)",
        border: variant === "ghost" ? "1px solid var(--border)" : "none",
        borderRadius: "0.5rem",
        padding: PADDINGS[size],
        fontSize: FONT_SIZES[size],
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
      {count > 0 ? ` (${String(count)})` : null}
    </button>
  );
};
