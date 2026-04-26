"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarImage } from "@/components/AvatarImage";
import { useRadiusAuth } from "@/lib/web3auth";

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProfilePfpUpload({ initialUrl, onUploaded }: { initialUrl?: string; onUploaded?: (url: string) => void }) {
  const { address, user } = useRadiusAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pfpUrl, setPfpUrl] = useState<string | null>(
    initialUrl || (typeof window !== "undefined" ? localStorage.getItem("pfpUrl") : null)
  );
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (initialUrl) queueMicrotask(() => setPfpUrl(initialUrl));
  }, [initialUrl]);

  async function uploadPfp(file: File) {
    const userId = user?.email || user?.name || address || "local-profile";
    setFileName(file.name);
    setStatus("Saving...");

    const localPreview = await readAsDataUrl(file);
    localStorage.setItem("pfpUrl", localPreview);
    setPfpUrl(localPreview);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

      const res = await fetch("/api/profile/pfp", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        localStorage.setItem("pfpUrl", data.url);
        setPfpUrl(data.url);
        onUploaded?.(data.url);
        setStatus("Uploaded globally");
      } else {
        setStatus("Saved locally");
      }
    } catch {
      setStatus("Saved locally");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-white/60 text-2xl font-black text-[#8f7cff] shadow-sm">
        <AvatarImage src={pfpUrl || undefined} fallback="R" className="h-20 w-20 object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPfp(file); }} />
        <button type="button" onClick={() => inputRef.current?.click()} className="ghost-btn w-full text-sm">Choose profile picture</button>
        <p className="mt-2 truncate text-xs text-[#8b8795]">{fileName || status || "PNG/JPG supported"}</p>
      </div>
    </div>
  );
}
