export function PrivacyBadge() {
  return (
    <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/8 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-amber-300/80">Privacy mode</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">Arc supports private transactions directionally, but this app does not have live private transfer wiring yet.</p>
        </div>
        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">
          Coming soon
        </span>
      </div>
    </div>
  );
}
