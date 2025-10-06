import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const p = searchParams.get("path") || "";
  if (!p) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  try {
    const projectRoot = process.cwd();
    const abs = path.resolve(projectRoot, p);

    // Prevent path traversal outside project root
    if (!abs.startsWith(projectRoot)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const stat = await fs.stat(abs).catch(() => null);
    if (!stat || !stat.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buf = await fs.readFile(abs, "utf8");
    return NextResponse.json({ content: buf });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to read file" }, { status: 500 });
  }
}