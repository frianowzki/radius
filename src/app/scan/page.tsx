"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";

declare global {
  interface BarcodeDetector {
    detect(source: HTMLVideoElement | HTMLImageElement | ImageBitmap | Blob): Promise<Array<{ rawValue?: string }>>;
  }
  interface BarcodeDetectorConstructor {
    new (options?: { formats?: string[] }): BarcodeDetector;
  }
  var BarcodeDetector: BarcodeDetectorConstructor;
}

function isPaymentUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname.startsWith("/pay");
  } catch {
    return url.startsWith("/pay");
  }
}

function extractPathAndSearch(url: string) {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url.startsWith("/") ? url : "";
  }
}

export default function ScanPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hasCamera] = useState<boolean>(() => typeof window !== "undefined" && "BarcodeDetector" in window);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<BarcodeDetector | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }

  async function startScan() {
    setScanError("");
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new BarcodeDetector({
        formats: ["qr_code"],
      });
      detectLoop();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Camera access failed");
      setScanning(false);
    }
  }

  async function detectLoop() {
    if (!scanning || !videoRef.current || !detectorRef.current) return;
    try {
      const results = await detectorRef.current.detect(videoRef.current);
      for (const result of results) {
        const raw = (result as unknown as { rawValue?: string }).rawValue || "";
        if (raw && isPaymentUrl(raw)) {
          stopCamera();
          router.push(extractPathAndSearch(raw));
          return;
        }
      }
    } catch {
      // Detection errors are benign; keep looping
    }
    rafRef.current = requestAnimationFrame(() => detectLoop());
  }

  function openLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const path = extractPathAndSearch(trimmed);
    if (path) router.push(path);
  }

  return (
    <AppShell>
      <div className="screen-pad">
        <header className="mb-7 flex items-center justify-between">
          <Link href="/" className="text-2xl">‹</Link>
          <h1 className="text-sm font-bold">Scan</h1>
          <span className="w-6" />
        </header>

        {scanning && hasCamera ? (
          <div className="soft-card rounded-[30px] p-5 text-center">
            <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-[24px] bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <div className="pointer-events-none absolute inset-0 rounded-[24px] border-2 border-dashed border-white/40" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-lg border-2 border-white/70" />
              </div>
            </div>
            <p className="mt-4 text-sm text-[#8b8795]">Point camera at a Radius QR code</p>
            {scanError && <p className="mt-2 text-xs text-red-500">{scanError}</p>}
            <button type="button" onClick={stopCamera} className="ghost-btn mt-4 w-full text-sm">Cancel</button>
          </div>
        ) : (
          <div className="soft-card rounded-[30px] p-6 text-center">
            <div className="scan-qr-icon mx-auto grid h-36 w-36 place-items-center rounded-[30px] border-2 border-dashed border-[var(--brand)]/30 bg-white/40 text-5xl text-[var(--brand)]">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="3" height="3" />
                <path d="M20 14v3h-3" />
                <path d="M14 20h3v-3" />
                <rect x="5" y="5" width="3" height="3" rx="0.5" className="fill-current" />
                <rect x="16" y="5" width="3" height="3" rx="0.5" className="fill-current" />
                <rect x="5" y="16" width="3" height="3" rx="0.5" className="fill-current" />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em]">Scan QR code</h2>
            <p className="mt-3 text-sm leading-6 text-[#8b8795]">
              {hasCamera
                ? "Use your camera to scan a Radius payment QR code, or paste a link below."
                : "Your browser does not support built-in QR scanning. Paste a payment link below."}
            </p>
            {hasCamera && (
              <button type="button" onClick={startScan} className="primary-btn mt-6 w-full text-sm">
                Open camera
              </button>
            )}
            <form onSubmit={openLink} className="mt-5 space-y-3 text-left">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                </span>
                <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste request link" className="radius-input pl-10 text-sm" />
              </div>
              <button type="submit" className="primary-btn w-full text-sm disabled:opacity-40" disabled={!value.trim()}>
                <span className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 4 0"/><path d="m12 8 0 8"/><path d="m12 12 4 0"/></svg>
                  Open payment link
                </span>
              </button>
            </form>
            {scanError && <p className="mt-3 text-xs text-red-500">{scanError}</p>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
