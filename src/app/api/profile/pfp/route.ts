import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyRegistryProof } from "@/lib/registry-proof-core";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function GET(req: Request) {
  try {
    const path = new URL(req.url).searchParams.get("path");
    if (!path || !path.startsWith("pfp/") || path.includes("..") || path.includes("\0")) {
      return NextResponse.json({ error: "Invalid profile image path" }, { status: 400 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Server storage not configured" }, { status: 503 });
    }

    const blob = await get(path, { access: "private", useCache: true }).catch(() => null);
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: "Profile image not found" }, { status: 404 });
    }

    return new Response(blob.stream, {
      headers: {
        "content-type": blob.blob.contentType || "image/jpeg",
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
        etag: blob.blob.etag,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;
    const proofRaw = formData.get("proof");

    if (!file || !userId) {
      return NextResponse.json({ error: "Missing file or userId" }, { status: 400 });
    }

    const address = userId.trim();
    if (!isAddress(address)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    let proof: unknown = null;
    if (typeof proofRaw === "string") {
      try { proof = JSON.parse(proofRaw); } catch { proof = null; }
    }
    if (!(await verifyRegistryProof(address, "profile", proof))) {
      return NextResponse.json({ error: "Wallet signature required" }, { status: 401 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 4 MB)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported image type (JPEG, PNG, WebP, GIF)" }, { status: 400 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Server storage not configured (BLOB_READ_WRITE_TOKEN missing)" }, { status: 503 });
    }

    const pathname = `pfp/${safePathPart(address.toLowerCase())}-${Date.now()}-${safePathPart(file.name)}`;
    await put(pathname, file, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: file.type || "application/octet-stream",
    });

    return NextResponse.json({ url: `/api/profile/pfp?path=${encodeURIComponent(pathname)}`, path: pathname });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
