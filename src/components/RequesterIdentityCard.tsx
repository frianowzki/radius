import type { Contact, UserIdentityProfile } from "@/lib/utils";
import { formatAddress, getIdentityLabel } from "@/lib/utils";

interface RequesterIdentityCardProps {
  title?: string;
  address?: string;
  profile?: UserIdentityProfile;
  contact?: Contact;
  tone?: "default" | "compact";
}

export function RequesterIdentityCard({
  title = "Requester identity",
  address,
  profile,
  contact,
  tone = "default",
}: RequesterIdentityCardProps) {
  const name = contact?.name || profile?.displayName || "Arc user";
  const handle = contact?.handle || profile?.handle;
  const avatar = contact?.avatar || profile?.avatar || name.charAt(0).toUpperCase();
  const context = contact?.note || profile?.bio || "Identity-rich requests feel safer, faster, and more memorable than raw wallet links.";
  const label = profile ? getIdentityLabel(profile) : handle ? `${name} (@${handle})` : name;

  return (
    <div className={`rounded-[28px] border border-white/8 bg-white/[0.04] ${tone === "compact" ? "p-5" : "p-6"}`}>
      <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">{title}</p>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-indigo-500/25 to-violet-500/20 text-lg font-semibold text-indigo-200">
          {avatar}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-zinc-100">{name}</p>
          <p className="mt-1 truncate text-sm text-zinc-400">{handle ? `@${handle}` : label}</p>
          {address && <p className="mt-2 font-mono text-xs text-zinc-500">{formatAddress(address)}</p>}
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-zinc-400">{context}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Identity</p>
          <p className="mt-1 text-sm text-zinc-200">{handle ? `Recognizable as @${handle}` : "App-level identity active"}</p>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Trust signal</p>
          <p className="mt-1 text-sm text-zinc-200">Clear amount, named requester, direct Arc payment path.</p>
        </div>
      </div>
    </div>
  );
}
