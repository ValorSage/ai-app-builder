import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

function safeJoin(base: string, target: string) {
  const targetPath = path.posix.normalize(target).replace(/^\/+/, "");
  if (targetPath.includes("..")) throw new Error("Invalid path");
  const abs = path.join(base, targetPath);
  if (!abs.startsWith(base)) throw new Error("Path escape detected");
  return abs;
}

export async function POST(req: NextRequest) {
  try {
    const { path: relPath } = await req.json();
    if (!relPath || typeof relPath !== "string") {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const base = path.join(projectRoot, "src");
    const abs = safeJoin(base, relPath);

    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) return NextResponse.json({ error: "File not found" }, { status: 404 });
    if (!stat.isFile()) return NextResponse.json({ error: "Only file deletion is supported" }, { status: 400 });

    await fs.unlink(abs);
    return NextResponse.json({ ok: true, deleted: relPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}