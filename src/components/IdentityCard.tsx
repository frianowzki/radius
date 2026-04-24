import type { UserIdentityProfile } from "@/lib/utils";

export function IdentityCard({ profile }: { profile: UserIdentityProfile }) {
  const avatar = profile.avatar || profile.displayName.charAt(0).toUpperCase();

  return (
    <div className="glass-panel rounded-[28px] p-6">
      <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">Your identity</p>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-indigo-500/25 to-violet-500/20 text-lg font-semibold text-indigo-200">
          {avatar}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-zinc-100">{profile.displayName}</p>
          <p className="truncate text-sm text-zinc-500">{profile.handle ? `@${profile.handle}` : "Username not claimed"}</p>
        </div>
      </div>
      {profile.bio && <p className="mt-4 text-sm leading-7 text-zinc-400">{profile.bio}</p>}
      <p className="mt-4 text-xs leading-6 text-zinc-500">
        This is app-level identity for now. Global username resolution can layer on top later.
      </p>
    </div>
  );
}
