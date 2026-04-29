"use client";

import { useEffect, useState } from "react";

/**
 * Returns true once the component has mounted on the client.
 * Use to gate any value that comes from localStorage / window / URL
 * so it doesn't differ between server-rendered HTML and the first
 * client render (which would crash mobile browsers via hydration mismatch).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: flip flag once after mount
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}
