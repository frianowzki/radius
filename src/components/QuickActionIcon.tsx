type QuickActionIconName = "send" | "request" | "swap" | "scan" | "contacts" | "bridge" | "wallet" | "pool" | "yield" | "history";

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

  if (name === "bridge") {
    return (
      <svg {...common}>
        <path d="M5 7.5h8.2a3.8 3.8 0 0 1 0 7.6H9.8" />
        <path d="M19 16.5h-8.2a3.8 3.8 0 0 1 0-7.6h3.4" />
        <path d="m8 4.8-3 2.7 3 2.7" />
        <path d="m16 13.8 3 2.7-3 2.7" />
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

  if (name === "history") {
    return (
      <svg {...common}>
        <path d="M7 3.8h10a1.7 1.7 0 0 1 1.7 1.7v15l-3.2-1.9-3.5 1.9-3.5-1.9-3.2 1.9v-15A1.7 1.7 0 0 1 7 3.8Z" />
        <path d="M8.7 8.1h6.6" />
        <path d="M8.7 11.8h6.6" />
        <path d="M8.7 15.5h4.2" />
      </svg>
    );
  }

  if (name === "wallet") {
    return (
      <svg {...common}>
        <path d="M4.2 7.5h14.1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.7a2 2 0 0 1-2-2V6.7a2 2 0 0 1 2-2h10.5" />
        <path d="M4 8h13.2" />
        <path d="M16.2 13.8h4" />
      </svg>
    );
  }

  if (name === "pool") {
    return (
      <svg {...common}>
        <path d="M8 7a4 4 0 1 0 8 0" />
        <path d="M4 11c0 3.3 3.6 6 8 6s8-2.7 8-6" />
        <path d="M4 7v4" />
        <path d="M20 7v4" />
        <path d="M8 19h8" />
      </svg>
    );
  }

  if (name === "yield") {
    return (
      <svg {...common}>
        <path d="M12 20V10" />
        <path d="M12 10c0-3 2.5-5 6-5 0 3.5-2 6-6 6" />
        <path d="M12 13c-3.5 0-6-2-6-5 3.2 0 6 1.8 6 5" />
        <path d="M6 20h12" />
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
