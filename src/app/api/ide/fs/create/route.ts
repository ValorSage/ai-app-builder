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

function defaultScaffold(filePath: string) {
  if (filePath.endsWith(".tsx")) {
    const name = path.basename(filePath, ".tsx");
    const comp = name.replace(/[^a-zA-Z0-9]/g, "").replace(/^./, (c) => c.toUpperCase());
    return `export const ${comp} = () => {\n  return (<div className=\"p-4\">${comp} component</div>);\n};\n`;
  }
  if (filePath.endsWith(".ts")) return "export {}\n";
  if (filePath.endsWith(".js")) return "// new file\n";
  if (filePath.endsWith(".jsx")) return "export default function Component(){ return (<div>Component</div>) }\n";
  if (filePath.endsWith(".json")) return "{}\n";
  if (filePath.endsWith(".css")) return ":root{}\n";
  return "\n";
}

export async function POST(req: NextRequest) {
  try {
    const { path: relPath, content } = await req.json();
    if (!relPath || typeof relPath !== "string") {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const base = path.join(projectRoot, "src");
    const abs = safeJoin(base, relPath);

    await fs.mkdir(path.dirname(abs), { recursive: true });
    const fileContent = typeof content === "string" ? content : defaultScaffold(relPath);
    await fs.writeFile(abs, fileContent, "utf8");

    return NextResponse.json({ ok: true, created: relPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}