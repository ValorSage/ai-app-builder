import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
const execAsync = promisify(exec);

type Issue = {
  id: string;
  type: "linter" | "compiler" | "ai";
  severity: "error" | "warning" | "info";
  file: string;
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
};

export async function GET(req: NextRequest) {
  try {
    const projectRoot = process.cwd();
    const issues: Issue[] = [];

    // 1. Get ESLint errors
    try {
      const { stdout } = await execAsync("npm run lint -- --format json", {
        cwd: projectRoot,
        timeout: 30000
      });
      
      try {
        const lintResults = JSON.parse(stdout);
        if (Array.isArray(lintResults)) {
          lintResults.forEach((fileResult: any) => {
            if (fileResult.messages && Array.isArray(fileResult.messages)) {
              fileResult.messages.forEach((msg: any, idx: number) => {
                issues.push({
                  id: `lint-${fileResult.filePath}-${msg.line}-${idx}`,
                  type: "linter",
                  severity: msg.severity === 2 ? "error" : "warning",
                  file: fileResult.filePath.replace(projectRoot, "").replace(/^[/\\]/, ""),
                  line: msg.line || 0,
                  column: msg.column,
                  message: msg.message,
                  suggestion: msg.suggestions?.[0]?.desc
                });
              });
            }
          });
        }
      } catch {
        // JSON parse error - skip linter issues
      }
    } catch {
      // ESLint execution error - skip
    }

    // 2. Get TypeScript compiler errors
    try {
      const { stderr } = await execAsync("npx tsc --noEmit", {
        cwd: projectRoot,
        timeout: 30000
      });

      if (stderr) {
        // Parse TypeScript error format: file.ts(line,col): error TS####: message
        const tsErrorRegex = /(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)/g;
        let match;
        let idx = 0;
        
        while ((match = tsErrorRegex.exec(stderr)) !== null) {
          const [, filePath, line, column, severity, message] = match;
          issues.push({
            id: `compiler-${filePath}-${line}-${idx++}`,
            type: "compiler",
            severity: severity as "error" | "warning",
            file: filePath.replace(projectRoot, "").replace(/^[/\\]/, ""),
            line: parseInt(line, 10),
            column: parseInt(column, 10),
            message: message.trim()
          });
        }
      }
    } catch {
      // TypeScript execution error - skip
    }

    // 3. Get AI-detected issues from stored analysis
    const aiIssuesPath = path.join(projectRoot, ".ide", "ai-issues.json");
    try {
      const aiIssuesContent = await fs.readFile(aiIssuesPath, "utf8");
      const aiIssues = JSON.parse(aiIssuesContent);
      if (Array.isArray(aiIssues)) {
        issues.push(...aiIssues);
      }
    } catch {
      // No AI issues file yet
    }

    return NextResponse.json({ issues, count: issues.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e), issues: [] }, { status: 500 });
  }
}

// POST - Add AI-detected issues
export async function POST(req: NextRequest) {
  try {
    const { issues: newIssues } = await req.json();
    
    if (!Array.isArray(newIssues)) {
      return NextResponse.json({ error: "issues must be an array" }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const ideDir = path.join(projectRoot, ".ide");
    const aiIssuesPath = path.join(ideDir, "ai-issues.json");

    // Ensure .ide directory exists
    await fs.mkdir(ideDir, { recursive: true });

    // Read existing AI issues
    let existingIssues: Issue[] = [];
    try {
      const content = await fs.readFile(aiIssuesPath, "utf8");
      existingIssues = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    // Merge and deduplicate
    const allIssues = [...existingIssues, ...newIssues];
    const uniqueIssues = allIssues.filter((issue, index, self) =>
      index === self.findIndex(i => i.id === issue.id)
    );

    // Save
    await fs.writeFile(aiIssuesPath, JSON.stringify(uniqueIssues, null, 2), "utf8");

    return NextResponse.json({ ok: true, count: uniqueIssues.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

// DELETE - Clear AI issues
export async function DELETE() {
  try {
    const projectRoot = process.cwd();
    const aiIssuesPath = path.join(projectRoot, ".ide", "ai-issues.json");
    
    await fs.writeFile(aiIssuesPath, "[]", "utf8");
    
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}