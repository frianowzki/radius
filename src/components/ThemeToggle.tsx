"use client";

import { useEffect, useRef, useState } from "react";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("radius-theme", theme);
}

/** Returns the main bg color for a given theme (matches the page). */
function themeBgColor(theme: "light" | "dark"): string {
  return theme === "dark" ? "#0b1120" : "#f8fafc";
}

/**
 * GPU-composited cross-fade: overlay fades in on the CURRENT bg color,
 * theme switches underneath, overlay fades out revealing the new bg.
 * Only one opacity change on a single composited layer — no layout thrash.
 */
function sweepTransition(current: "light" | "dark", next: "light" | "dark") {
  let el = document.querySelector<HTMLDivElement>(".theme-sweep");
  if (!el) {
    el = document.createElement("div");
    el.className = "theme-sweep";
    document.body.appendChild(el);
  }

  // Lock overlay to current theme's bg (so it looks like a solid freeze-frame)
  el.style.backgroundColor = themeBgColor(current);
  el.style.opacity = "1";

  // Theme switches underneath while overlay covers everything
  requestAnimationFrame(() => {
    applyTheme(next);
    // Small delay so paint settles, then fade out on new bg
    requestAnimationFrame(() => {
      el.style.backgroundColor = themeBgColor(next);
      el.style.opacity = "0";
    });
  });
}

export function ThemeToggle({ iconOnly = true }: { iconOnly?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const animating = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("radius-theme");
    const preferred = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const next = saved === "dark" || saved === "light" ? saved : preferred;
    setTheme(next);
    applyTheme(next);
  }, []);

  function toggleTheme() {
    if (animating.current) return;
    animating.current = true;

    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      sweepTransition(current, next);
      // Release after transition completes
      setTimeout(() => { animating.current = false; }, 600);
      return next;
    });
  }

  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
      className={`theme-toggle${iconOnly ? " icon-only" : ""}`}
    >
      <span className="theme-toggle-dot" aria-hidden="true">
        {dark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.7 6.7 0 0 0 9.8 9.8Z"/></svg>
        )}
      </span>
      {!iconOnly && <span>{dark ? "Light" : "Dark"}</span>}
    </button>
  );
}
