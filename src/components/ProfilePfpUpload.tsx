"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarImage } from "@/components/AvatarImage";
import { useRadiusAuth } from "@/lib/web3auth";
import { getRegistryProof } from "@/lib/registry-proof";
import { createWalletClient, custom } from "viem";
import { arcTestnet } from "@/config/wagmi";

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
    const userId = address || user?.email || user?.name || "local-profile";
    setFileName(file.name);
    setStatus("Saving...");

    const localPreview = await readAsDataUrl(file);
    try {
      localStorage.setItem("pfpUrl", localPreview);
    } catch {
      // Image too large for localStorage (~5MB limit) — skip local caching.
    }
    setPfpUrl(localPreview);

    try {
      // Generate wallet signature proof before uploading.
      let proof = address ? await getRegistryProof(address, "profile") : null;
      if (!proof && address) {
        const provider = (globalThis as typeof globalThis & { ethereum?: unknown }).ethereum;
        if (provider) {
          try {
            const wc = createWalletClient({ account: address as `0x${string}`, chain: arcTestnet, transport: custom(provider as never) });
            proof = await getRegistryProof(address, "profile", {
              prompt: true,
              signMessage: (msg: string) => wc.signMessage({ message: msg }),
            });
          } catch { /* fall through — upload will fail with 401 */ }
        }
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", address || userId);
      if (proof) formData.append("proof", JSON.stringify(proof));

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
    <div className="profile-upload-row">
      <div className="profile-upload-avatar">
        <AvatarImage src={pfpUrl || undefined} fallback="R" className="h-full w-full object-cover" />
        <span className="profile-upload-edit" aria-hidden="true">✎</span>
      </div>
      <div className="min-w-0 flex-1">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPfp(file); }} />
        <button type="button" onClick={() => inputRef.current?.click()} className="profile-upload-button">▧ Choose profile picture</button>
        <p className="mt-1 truncate text-[11px] text-[#8b8795]">{fileName || status || "PNG/JPG supported"}</p>
      </div>
    </div>
  );
}
