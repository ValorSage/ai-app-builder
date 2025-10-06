import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json();
    if (!idea || typeof idea !== "string") {
      return NextResponse.json({ error: "Invalid idea" }, { status: 400 });
    }

    // Very simple heuristic plan generator for MVP
    const plan: string[] = [
      "Create the basic project structure (src, public folders)",
      "Create the main entry file (src/app/page.tsx)",
      "Create the global layout (src/app/layout.tsx)",
      "Add a homepage component with hero section",
      "Set up Node.js + Express backend endpoint (e.g., /api/ping)",
      "Add project configuration files (package.json, tsconfig.json)",
      "Wire the IDE: file explorer, code editor, and right-side tabs",
    ];

    // Lightly tailor the plan by echoing keywords from the idea
    const keywords = idea.trim().split(/\s+/).slice(0, 6).join(" ");
    plan.unshift(`Understand requirements: ${keywords} ...`);

    return NextResponse.json({ plan });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to build plan" }, { status: 500 });
  }
}