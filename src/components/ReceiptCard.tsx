interface ReceiptCardProps {
  title: string;
  amount: string;
  token: string;
  status: string;
  fromLabel?: string;
  toLabel?: string;
  note?: string;
  metaLabel?: string;
  metaValue?: string;
  shareText?: string;
}

export function ReceiptCard({
  title,
  amount,
  token,
  status,
  fromLabel,
  toLabel,
  note,
  metaLabel,
  metaValue,
  shareText,
}: ReceiptCardProps) {
  async function handleShare() {
    if (!shareText) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${title} receipt`,
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
    } catch {
      // ignore canceled shares
    }
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(99,102,241,0.16),rgba(24,24,27,0.38))] p-6 shadow-2xl shadow-indigo-500/10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">
            {amount} {token}
          </p>
        </div>
        <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-zinc-300">
          {status}
        </div>
      </div>

      <div className="mt-8 space-y-3 text-sm">
        {fromLabel && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">From</span>
            <span className="text-zinc-200">{fromLabel}</span>
          </div>
        )}
        {toLabel && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">To</span>
            <span className="text-zinc-200">{toLabel}</span>
          </div>
        )}
        {note && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">Note</span>
            <span className="text-right text-zinc-200">{note}</span>
          </div>
        )}
        {metaLabel && metaValue && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">{metaLabel}</span>
            <span className="text-right text-zinc-200">{metaValue}</span>
          </div>
        )}
      </div>

      {shareText && (
        <button
          onClick={handleShare}
          className="mt-6 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/14"
        >
          Share receipt
        </button>
      )}
    </div>
  );
}
