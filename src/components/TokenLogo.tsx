export function TokenLogo({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const isEurc = symbol.toUpperCase() === "EURC";
  return (
    <span
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center rounded-full text-xs font-black text-white shadow-sm ${isEurc ? "bg-[#2775ca]" : "bg-[#2775ca]"}`}
      aria-label={`${symbol} logo`}
    >
      {isEurc ? "€" : "$"}
    </span>
  );
}
