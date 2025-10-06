import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";
import { parser } from "@babel/parser";
import traverse from "@babel/traverse";

export const runtime = "nodejs";
export const maxDuration = 60;

type Issue = {
  type: "bug" | "warning" | "suggestion";
  line: number;
  message: string;
  suggestion: string;
};

function safeJoin(base: string, target: string) {
  const targetPath = path.posix.normalize(target).replace(/^\/+/, "");
  if (targetPath.includes("..")) throw new Error("Invalid path");
  const abs = path.join(base, targetPath);
  if (!abs.startsWith(base)) throw new Error("Path escape detected");
  return abs;
}

async function analyzeCode(filePath: string, content: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  
  try {
    // Parse TypeScript/JavaScript code
    const ast = parser.parse(content, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });

    // Basic static analysis
    traverse(ast, {
      ImportDeclaration(path: any) {
        // Check for unused imports (simplified)
        const importPath = path.node.source.value;
        if (importPath.startsWith(".") && !content.includes(importPath.split("/").pop())) {
          issues.push({
            type: "suggestion",
            line: path.node.loc?.start.line || 0,
            message: `Possibly unused import: ${importPath}`,
            suggestion: "Remove unused imports to reduce bundle size"
          });
        }
      },
      FunctionDeclaration(path: any) {
        // Check for functions without return type (TypeScript)
        if (!path.node.returnType && filePath.endsWith(".ts")) {
          issues.push({
            type: "warning",
            line: path.node.loc?.start.line || 0,
            message: `Function '${path.node.id?.name}' has no return type`,
            suggestion: "Add explicit return type for better type safety"
          });
        }
      },
      VariableDeclarator(path: any) {
        // Check for var usage
        if (path.parent.kind === "var") {
          issues.push({
            type: "suggestion",
            line: path.node.loc?.start.line || 0,
            message: "Using 'var' is discouraged",
            suggestion: "Use 'const' or 'let' instead of 'var'"
          });
        }
      }
    });
  } catch (e) {
    // If parsing fails, it's a syntax error
    issues.push({
      type: "bug",
      line: 0,
      message: `Syntax error: ${(e as Error).message}`,
      suggestion: "Fix syntax errors before proceeding"
    });
  }

  return issues;
}

export async function POST(req: NextRequest) {
  try {
    const { command, apiKey, model = "gpt-4" } = await req.json();
    
    if (!command || typeof command !== "string") {
      return NextResponse.json({ error: "command required" }, { status: 400 });
    }

    const effectiveApiKey = apiKey || req.headers.get("x-ai-key") || process.env.OPENAI_API_KEY;
    const effectiveModel = model || req.headers.get("x-ai-model") || "gpt-4";

    if (!effectiveApiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: effectiveApiKey });
    const projectRoot = process.cwd();
    const srcBase = path.join(projectRoot, "src");

    // System prompt for the AI agent
    const systemPrompt = `You are a coding assistant integrated into an IDE. You can execute the following operations:

1. CREATE_FILE: Create a new file with content
2. EDIT_FILE: Modify existing file content
3. DELETE_FILE: Delete a file
4. ANALYZE_CODE: Analyze code for issues
5. INSTALL_PACKAGE: Install an npm package
6. UNINSTALL_PACKAGE: Uninstall an npm package
7. LIST_FILES: List all project files

When the user asks you to perform an action, respond with a JSON object containing:
{
  "action": "CREATE_FILE" | "EDIT_FILE" | "DELETE_FILE" | "ANALYZE_CODE" | "INSTALL_PACKAGE" | "UNINSTALL_PACKAGE" | "LIST_FILES" | "EXPLAIN",
  "path": "relative/path/to/file" (for file operations),
  "content": "file content" (for CREATE_FILE or EDIT_FILE),
  "package": "package-name" (for package operations),
  "message": "explanation for the user"
}

Examples:
- "Create a Button component" → {"action": "CREATE_FILE", "path": "components/Button.tsx", "content": "...", "message": "Created Button component"}
- "Install axios" → {"action": "INSTALL_PACKAGE", "package": "axios", "message": "Installing axios..."}
- "Analyze src/app/page.tsx" → {"action": "ANALYZE_CODE", "path": "app/page.tsx", "message": "Analyzing code..."}

Be concise and always provide helpful explanations.`;

    // Call OpenAI to interpret the command
    const completion = await openai.chat.completions.create({
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: command }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || "";
    
    // Try to parse as JSON
    let parsedResponse: any;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || responseText.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
      parsedResponse = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({
        message: responseText,
        action: "EXPLAIN"
      });
    }

    const { action, path: relPath, content, package: packageName, message } = parsedResponse;

    // Execute the action
    let result: any = { message };

    switch (action) {
      case "CREATE_FILE": {
        if (!relPath) throw new Error("path required for CREATE_FILE");
        const abs = safeJoin(srcBase, relPath);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content || "", "utf8");
        result.created = relPath;
        break;
      }

      case "EDIT_FILE": {
        if (!relPath) throw new Error("path required for EDIT_FILE");
        const abs = safeJoin(srcBase, relPath);
        await fs.writeFile(abs, content || "", "utf8");
        result.edited = relPath;
        break;
      }

      case "DELETE_FILE": {
        if (!relPath) throw new Error("path required for DELETE_FILE");
        const abs = safeJoin(srcBase, relPath);
        await fs.unlink(abs);
        result.deleted = relPath;
        break;
      }

      case "ANALYZE_CODE": {
        if (!relPath) throw new Error("path required for ANALYZE_CODE");
        const abs = safeJoin(srcBase, relPath);
        const fileContent = await fs.readFile(abs, "utf8");
        const issues = await analyzeCode(relPath, fileContent);
        result.issues = issues;
        result.analyzed = relPath;
        break;
      }

      case "INSTALL_PACKAGE": {
        if (!packageName) throw new Error("package required for INSTALL_PACKAGE");
        result.package = packageName;
        result.needsExecution = true; // Frontend should call /api/packages/install
        break;
      }

      case "UNINSTALL_PACKAGE": {
        if (!packageName) throw new Error("package required for UNINSTALL_PACKAGE");
        result.package = packageName;
        result.needsExecution = true; // Frontend should call /api/packages/install with action=uninstall
        break;
      }

      case "LIST_FILES": {
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
        result.files = files;
        break;
      }

      default:
        result.action = "EXPLAIN";
    }

    return NextResponse.json({
      ...result,
      action,
      fullResponse: responseText
    });

  } catch (e: any) {
    return NextResponse.json({ 
      error: e?.message || String(e),
      action: "ERROR"
    }, { status: 500 });
  }
}