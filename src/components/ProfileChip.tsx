import { AvatarImage } from "@/components/AvatarImage";
import { type Contact, formatAddress, type UserIdentityProfile } from "@/lib/utils";

interface ProfileChipProps {
  contact?: Contact;
  profile?: UserIdentityProfile;
  address?: string;
  fallbackLabel?: string;
}

export function ProfileChip({ contact, profile, address, fallbackLabel }: ProfileChipProps) {
  const label =
    contact?.name ||
    profile?.displayName ||
    fallbackLabel ||
    (address ? formatAddress(address) : "Unknown");
  const secondary =
    contact?.handle ||
    profile?.handle ||
    (address ? formatAddress(address) : undefined);
  const avatar = contact?.avatar || profile?.avatar;

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.05] px-3 py-2">
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-sm font-semibold text-indigo-200">
        <AvatarImage src={avatar} fallback={label} />
      </div>
      <div className="min-w-0 text-left">
        <div className="truncate text-sm font-medium text-zinc-100">{label}</div>
        {secondary && (
          <div className="truncate text-xs text-zinc-500">{secondary}</div>
        )}
      </div>
    </div>
  );
}
