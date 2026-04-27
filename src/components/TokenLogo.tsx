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
        <path className="token-logo-rail" d="M20.5 14.6a22 22 0 0 0 0 34.8" />
        <path className="token-logo-rail" d="M43.5 14.6a22 22 0 0 1 0 34.8" />
        <path className="token-logo-rail token-logo-rail-small" d="M23.9 22.7a13.5 13.5 0 0 0 0 18.6" />
        <path className="token-logo-rail token-logo-rail-small" d="M40.1 22.7a13.5 13.5 0 0 1 0 18.6" />
        <text x="32" y="41.6" textAnchor="middle" aria-hidden="true">
          {isEurc ? "€" : "$"}
        </text>
      </svg>
    </span>
  );
}
