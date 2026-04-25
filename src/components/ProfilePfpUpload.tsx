"use client";

import Image from "next/image";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

export function ProfilePfpUpload() {
  const { user } = usePrivy();
  const [pfpUrl, setPfpUrl] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("pfpUrl") : null
  );

  async function uploadPfp(file: File) {
    if (!user?.id) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", user.id);

    const res = await fetch("/api/profile/pfp", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.url) {
      localStorage.setItem("pfpUrl", data.url);
      setPfpUrl(data.url);
    }
  }

  return (
    <div className="space-y-3">
      {pfpUrl && (
        <Image
          src={pfpUrl}
          alt="Profile"
          width={80}
          height={80}
          className="h-20 w-20 rounded-full object-cover"
        />
      )}

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadPfp(file);
        }}
      />
    </div>
  );
}
