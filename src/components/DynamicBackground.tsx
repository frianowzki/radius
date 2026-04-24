"use client";

export function DynamicBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(6,6,6,0.94),_rgba(6,6,6,0.98))]" />
      <div className="absolute inset-x-0 top-[-8rem] mx-auto h-72 w-72 rounded-full bg-white/6 blur-3xl animate-float-slow" />
      <div className="absolute -left-16 top-1/3 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl animate-float-slower" />
      <div className="absolute -right-10 bottom-24 h-56 w-56 rounded-full bg-emerald-400/8 blur-3xl animate-float-slowest" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05),_transparent_34%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent,_rgba(0,0,0,0.36))]" />
    </div>
  );
}
