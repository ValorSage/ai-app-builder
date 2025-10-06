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

function summarize(filePath: string, code: string) {
  const ext = path.extname(filePath).toLowerCase();
  const lines = code.split(/\r?\n/);
  const lineCount = lines.length;
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || "";

  let language = "plaintext";
  if ([".ts", ".tsx"].includes(ext)) language = "TypeScript";
  else if ([".js", ".jsx"].includes(ext)) language = "JavaScript";
  else if (ext === ".json") language = "JSON";
  else if (ext === ".css") language = "CSS";
  else if (ext === ".md") language = "Markdown";

  const exports = [] as string[];
  const exportRegexes = [
    /export\s+default\s+function\s+(\w+)/,
    /export\s+default\s+(\w+)/,
    /export\s+const\s+(\w+)/g,
    /module\.exports\s*=\s*(\w+)/,
  ];
  for (const rx of exportRegexes) {
    if (rx instanceof RegExp && rx.flags.includes("g")) {
      let m: RegExpExecArray | null;
      while ((m = rx.exec(code))) exports.push(m[1]);
    } else {
      const m = (rx as RegExp).exec(code);
      if (m && m[1]) exports.push(m[1]);
    }
  }

  const imports = (code.match(/\bimport\b/g) || []).length;
  const requires = (code.match(/\brequire\(/g) || []).length;

  return {
    language,
    lineCount,
    summary: `This ${language} file has ${lineCount} lines, ${imports} ES imports and ${requires} CommonJS requires. First non-empty line: ${firstNonEmpty.slice(0, 120)}${firstNonEmpty.length > 120 ? "…" : ""}`,
    exports,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const relPath = searchParams.get("path");
    if (!relPath) return NextResponse.json({ error: "path required" }, { status: 400 });

    const projectRoot = process.cwd();
    const base = path.join(projectRoot, "src");
    const abs = safeJoin(base, relPath);
    const code = await fs.readFile(abs, "utf8");

    const info = summarize(relPath, code);
    return NextResponse.json({ ok: true, path: relPath, ...info });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}