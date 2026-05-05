type QuickActionIconName = "send" | "request" | "swap" | "scan" | "contacts" | "bridge";

export function QuickActionIcon({ name }: { name: QuickActionIconName }) {
  const common = {
    className: "h-6 w-6",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "send") {
    return (
      <svg {...common}>
        <path d="M4 11.5 20 4l-7.5 16-2.2-6.3L4 11.5Z" />
        <path d="m10.3 13.7 4.1-4.1" />
      </svg>
    );
  }

  if (name === "request") {
    return (
      <svg {...common}>
        <path d="M12 3.8v11.1" />
        <path d="m7.4 10.3 4.6 4.6 4.6-4.6" />
        <path d="M5.2 16.9v3.3h13.6v-3.3" />
      </svg>
    );
  }

  if (name === "swap") {
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </svg>
    );
  }

  if (name === "scan") {
    return (
      <svg {...common}>
        <path d="M8 4H5a1 1 0 0 0-1 1v3" />
        <path d="M16 4h3a1 1 0 0 1 1 1v3" />
        <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
        <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
      </svg>
    );
  }

  if (name === "contacts") {
    return (
      <svg {...common}>
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M7 7h12" />
      <path d="m15 3 4 4-4 4" />
      <path d="M17 17H5" />
      <path d="m9 21-4-4 4-4" />
    </svg>
  );
}
