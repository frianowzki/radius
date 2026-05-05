"use client";

import { useEffect, useState } from "react";

export function AvatarImage({
  src,
  fallback,
  className = "",
}: {
  src?: string;
  fallback: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (fallback || "R").slice(0, 1).toUpperCase();

  // Reset failed state when src changes so a new URL gets a fresh attempt
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <span>{letter}</span>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className || "h-full w-full object-cover"}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
