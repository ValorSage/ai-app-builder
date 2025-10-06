import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { package: packageName, action = "install" } = await req.json();
    
    if (!packageName || typeof packageName !== "string") {
      return NextResponse.json({ error: "package name required" }, { status: 400 });
    }

    const projectRoot = process.cwd();
    
    // Validate action
    if (!["install", "uninstall"].includes(action)) {
      return NextResponse.json({ error: "action must be install or uninstall" }, { status: 400 });
    }

    const command = action === "install" 
      ? `npm install ${packageName}` 
      : `npm uninstall ${packageName}`;

    // Execute npm command
    const { stdout, stderr } = await execAsync(command, { 
      cwd: projectRoot,
      timeout: 120000 // 2 minute timeout
    });

    // Read updated package.json
    const packageJsonPath = path.join(projectRoot, "package.json");
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    return NextResponse.json({ 
      ok: true, 
      package: packageName,
      action,
      stdout,
      stderr,
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {}
    });
  } catch (e: any) {
    return NextResponse.json({ 
      error: e?.message || String(e),
      stderr: e?.stderr || ""
    }, { status: 500 });
  }
}