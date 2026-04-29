"use client";

import { useEffect } from "react";
import { installGlobalErrorHandlers } from "@/lib/log-client";

export function GlobalErrorListeners() {
  useEffect(() => { installGlobalErrorHandlers(); }, []);
  return null;
}
