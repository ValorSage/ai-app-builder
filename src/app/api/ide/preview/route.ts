import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  // In a real implementation, this would build and boot a dev server, then return its URL.
  // For now, we return a conventional local URL expected by the iframe.
  const url = process.env.NEXT_PUBLIC_PREVIEW_URL || "http://localhost:3001";
  return NextResponse.json({ ok: true, url });
}

export const runtime = "nodejs";