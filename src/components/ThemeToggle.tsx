"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("radius-theme");
    const next = saved === "dark" || saved === "light"
      ? saved
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    queueMicrotask(() => setTheme(next));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("radius-theme", theme);
  }, [theme]);

  return (
    <button type="button" onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} className={`theme-toggle icon-only ${className}`} aria-label="Toggle theme">
      <span className="theme-toggle-dot">{theme === "dark" ? "☾" : "☼"}</span>
    </button>
  );
}
