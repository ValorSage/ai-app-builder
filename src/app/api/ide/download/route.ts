import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import { promises as fs } from "fs";
import path from "path";

async function* walkDir(dir: string, base: string): AsyncGenerator<{ path: string; content: string }> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip common directories that shouldn't be in the download
      if ([".next", "node_modules", ".git", "dist", "build"].includes(entry.name)) continue;
      yield* walkDir(fullPath, base);
    } else {
      const relativePath = path.relative(base, fullPath);
      const content = await fs.readFile(fullPath, "utf8");
      yield { path: relativePath, content };
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectName = searchParams.get("name") || "project";

    const projectRoot = process.cwd();
    const srcPath = path.join(projectRoot, "src");

    // Create a zip archive stream
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    // Collect all files
    const files: Array<{ path: string; content: string }> = [];
    for await (const file of walkDir(srcPath, srcPath)) {
      files.push(file);
    }

    // Add package.json (basic template)
    const packageJson = {
      name: projectName.toLowerCase().replace(/\s+/g, "-"),
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev --turbopack",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: {
        next: "15.3.5",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^19",
        "@types/react-dom": "^19",
        typescript: "^5",
      },
    };

    // Add README.md
    const readme = `# ${projectName}\n\nGenerated project from The Smart Engineer for Full Integration.\n\n## Getting Started\n\n1. Install dependencies:\n\`\`\`bash\nnpm install\n\`\`\`\n\n2. Run the development server:\n\`\`\`bash\nnpm run dev\n\`\`\`\n\n3. Open [http://localhost:3000](http://localhost:3000) in your browser.\n`;

    // Convert archive to ReadableStream for Next.js response
    const stream = new ReadableStream({
      start(controller) {
        archive.on("data", (chunk) => {
          controller.enqueue(chunk);
        });

        archive.on("end", () => {
          controller.close();
        });

        archive.on("error", (err) => {
          controller.error(err);
        });

        // Add all files to archive
        files.forEach(({ path: filePath, content }) => {
          archive.append(content, { name: `${projectName}/src/${filePath}` });
        });

        // Add package.json and README
        archive.append(JSON.stringify(packageJson, null, 2), { name: `${projectName}/package.json` });
        archive.append(readme, { name: `${projectName}/README.md` });

        // Finalize the archive
        archive.finalize();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${projectName}.zip"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export const runtime = "nodejs";