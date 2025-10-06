import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

function safeJoin(base: string, target: string) {
  const targetPath = path.posix.normalize(target).replace(/^\/+/g, "");
  if (targetPath.includes("..")) throw new Error("Invalid path");
  const abs = path.join(base, targetPath);
  if (!abs.startsWith(base)) throw new Error("Path escape detected");
  return abs;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path: relPath, content, find, replace } = body as { path?: string; content?: string; find?: string; replace?: string };
    if (!relPath || typeof relPath !== "string") {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const base = path.join(projectRoot, "src");
    const abs = safeJoin(base, relPath);

    let text = await fs.readFile(abs, "utf8");

    if (typeof content === "string") {
      // Overwrite whole file
      text = content;
    } else if (typeof find === "string" && typeof replace === "string") {
      // Single replacement (first occurrence)
      text = text.replace(find, replace);
    } else {
      return NextResponse.json({ error: "provide either content or find+replace" }, { status: 400 });
    }

    await fs.writeFile(abs, text, "utf8");

    return NextResponse.json({ ok: true, edited: relPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}