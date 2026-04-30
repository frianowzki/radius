import type { CSSProperties } from "react";

export function TokenLogo({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const normalized = symbol.toUpperCase();
  const isEurc = normalized === "EURC";

  return (
    <span
      style={{ "--token-logo-size": `${size}px` } as CSSProperties}
      className={`token-logo ${isEurc ? "token-logo-eurc" : "token-logo-usdc"}`}
      aria-label={`${normalized} logo`}
      role="img"
    >
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path className="token-logo-rail" d="M22.5 9.5a25.5 25.5 0 0 0 0 45" />
        <path className="token-logo-rail" d="M41.5 9.5a25.5 25.5 0 0 1 0 45" />
        <circle className="token-logo-ring" cx="32" cy="32" r="17.5" />
        <text className="token-logo-symbol" x="32" y="38">
          {isEurc ? "€" : "$"}
        </text>
      </svg>
    </span>
  );
}
