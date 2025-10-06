import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// Build a file tree from disk starting at baseDir, returning nodes with {name, path, type, children}
async function readDirRecursive(baseDir: string, rel: string = ""): Promise<any[]> {
  const abs = path.join(baseDir, rel);
  const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => []);
  const nodes: any[] = [];

  for (const dirent of entries) {
    const name = dirent.name;
    // Skip unwanted directories/files
    if (name.startsWith(".")) continue; // hidden like .git, .next, etc.
    if (["node_modules", ".next", ".git"].includes(name)) continue;

    const relPath = rel ? path.posix.join(rel.replace(/\\/g, "/"), name) : name;
    const absPath = path.join(baseDir, relPath);

    if (dirent.isDirectory()) {
      const children = await readDirRecursive(baseDir, relPath);
      nodes.push({ name, path: relPath, type: "folder", children });
    } else if (dirent.isFile()) {
      nodes.push({ name, path: relPath, type: "file" });
    }
  }

  // Sort folders first, then files, alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export async function GET() {
  try {
    const projectRoot = process.cwd();

    // Build top-level groups: src and public if present
    const tree: any[] = [];

    const srcDir = path.join(projectRoot, "src");
    const hasSrc = await fs
      .stat(srcDir)
      .then((s) => s.isDirectory())
      .catch(() => false);
    if (hasSrc) {
      const children = await readDirRecursive(srcDir);
      tree.push({ name: "src", path: "src", type: "folder", children });
    }

    const publicDir = path.join(projectRoot, "public");
    const hasPublic = await fs
      .stat(publicDir)
      .then((s) => s.isDirectory())
      .catch(() => false);
    if (hasPublic) {
      const children = await readDirRecursive(publicDir);
      tree.push({ name: "public", path: "public", type: "folder", children });
    }

    // Include a few useful root files if they exist
    const rootFiles = [
      "package.json",
      "tsconfig.json",
      "next.config.ts",
      "README.md",
      "eslint.config.mjs",
      "postcss.config.mjs",
      "tailwind.config.ts",
    ];
    for (const f of rootFiles) {
      const p = path.join(projectRoot, f);
      const exists = await fs
        .stat(p)
        .then((s) => s.isFile())
        .catch(() => false);
      if (exists) tree.push({ name: f, path: f, type: "file" });
    }

    return NextResponse.json({ tree });
  } catch (e: any) {
    return NextResponse.json({ tree: [], error: e?.message || String(e) }, { status: 500 });
  }
}