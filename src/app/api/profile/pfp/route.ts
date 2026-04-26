import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("pfp/")) {
    return NextResponse.json({ error: "Missing profile image path" }, { status: 400 });
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
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const userId = formData.get("userId") as string | null;

  if (!file || !userId) {
    return NextResponse.json({ error: "Missing file or userId" }, { status: 400 });
  }

  const pathname = `pfp/${safePathPart(userId)}-${Date.now()}-${safePathPart(file.name)}`;
  await put(pathname, file, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: file.type || "application/octet-stream",
  });

  return NextResponse.json({ url: `/api/profile/pfp?path=${encodeURIComponent(pathname)}`, path: pathname });
}
