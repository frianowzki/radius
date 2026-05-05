import { AvatarImage } from "@/components/AvatarImage";
import { type Contact, formatAddress, type UserIdentityProfile } from "@/lib/utils";

interface ProfileChipProps {
  contact?: Contact;
  profile?: UserIdentityProfile;
  address?: string;
  fallbackLabel?: string;
  variant?: "dark" | "light";
}

export function ProfileChip({ contact, profile, address, fallbackLabel, variant = "dark" }: ProfileChipProps) {
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
  const isLight = variant === "light";

  return (
    <div className={`inline-flex items-center gap-3 rounded-2xl border px-3 py-2 ${isLight ? "border-[#17151f]/8 bg-white/60" : "border-white/8 bg-white/[0.05]"}`}>
      <div className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-sm font-semibold ${isLight ? "bg-gradient-to-br from-[#6366f1]/15 to-[#3b82f6]/15 text-[#3b82f6]" : "bg-gradient-to-br from-[#6366f1]/25 to-[#3b82f6]/25 text-[#bfdbfe]"}`}>
        <AvatarImage src={avatar} fallback={label} />
      </div>
      <div className="min-w-0 text-left">
        <div className={`truncate text-sm font-medium ${isLight ? "text-[#17151f]" : "text-zinc-100"}`}>{label}</div>
        {secondary && (
          <div className={`truncate text-xs ${isLight ? "text-[#8b8795]" : "text-zinc-500"}`}>{secondary}</div>
        )}
      </div>
    </div>
  );
}
