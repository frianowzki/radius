"use client";

export function DynamicBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_50%_100%,_rgba(168,85,247,0.14),_transparent_34%),linear-gradient(180deg,_rgba(9,9,11,0.96),_rgba(9,9,11,0.99))]" />
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-indigo-500/18 blur-3xl animate-float-slow" />
      <div className="absolute right-[-4rem] top-1/3 h-80 w-80 rounded-full bg-fuchsia-500/14 blur-3xl animate-float-slower" />
      <div className="absolute bottom-[-5rem] left-1/3 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl animate-float-slowest" />
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_80%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent,_rgba(0,0,0,0.42))]" />
    </div>
  );
}
