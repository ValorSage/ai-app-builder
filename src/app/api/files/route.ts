import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

function safeJoin(base: string, target: string) {
  const targetPath = path.posix.normalize(target).replace(/^\/+/, "");
  if (targetPath.includes("..")) throw new Error("Invalid path");
  const abs = path.join(base, targetPath);
  if (!abs.startsWith(base)) throw new Error("Path escape detected");
  return abs;
}

// GET /api/files - List all files
export async function GET() {
  try {
    const projectRoot = process.cwd();
    const srcBase = path.join(projectRoot, "src");
    
    const files: string[] = [];
    
    async function walk(dir: string, base: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(base, fullPath);
        
        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            await walk(fullPath, base);
          }
        } else if (entry.isFile()) {
          files.push(relPath.replace(/\\/g, "/"));
        }
      }
    }
    
    await walk(srcBase, srcBase);
    
    return NextResponse.json({ files });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

// POST /api/files - Create new file
export async function POST(req: NextRequest) {
  try {
    const { path: relPath, content = "" } = await req.json();
    if (!relPath || typeof relPath !== "string") {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const base = path.join(projectRoot, "src");
    const abs = safeJoin(base, relPath);

    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");

    return NextResponse.json({ ok: true, path: relPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

// PUT /api/files - Update file content
export async function PUT(req: NextRequest) {
  try {
    const { path: relPath, content } = await req.json();
    if (!relPath || typeof relPath !== "string") {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content must be string" }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const base = path.join(projectRoot, "src");
    const abs = safeJoin(base, relPath);

    await fs.writeFile(abs, content, "utf8");

    return NextResponse.json({ ok: true, path: relPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

// DELETE /api/files - Delete file
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const relPath = searchParams.get("path");
    
    if (!relPath || typeof relPath !== "string") {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const base = path.join(projectRoot, "src");
    const abs = safeJoin(base, relPath);

    await fs.unlink(abs);

    return NextResponse.json({ ok: true, path: relPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}