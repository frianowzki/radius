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
            <div className="mx-auto grid h-32 w-32 place-items-center rounded-[30px] bg-white/70 text-5xl text-[#8f7cff]">⌗</div>
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
              <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste request link" className="radius-input text-sm" />
              <button type="submit" className="primary-btn w-full text-sm disabled:opacity-40" disabled={!value.trim()}>Open payment link</button>
            </form>
            {scanError && <p className="mt-3 text-xs text-red-500">{scanError}</p>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
