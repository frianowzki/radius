"use client";

export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <span className={`theme-toggle-disabled ${className}`} aria-label="Light mode only">
      Light
    </span>
  );
}
