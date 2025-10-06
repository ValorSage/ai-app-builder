import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, model } = await req.json();

    if (!apiKey || !model) {
      return NextResponse.json({ ok: false, error: "Missing apiKey or model" }, { status: 400 });
    }

    // Minimal sanity: allow only expected models for now
    const allowed = new Set(["gemini-2.5-pro", "gemini-2.5-flash"]);
    if (!allowed.has(model)) {
      return NextResponse.json({ ok: false, error: "Unsupported model" }, { status: 400 });
    }

    // Perform a tiny verification call to Google Generative Language API
    // Using v1beta generateContent endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: "ping" }],
        },
      ],
      generationConfig: { maxOutputTokens: 1 },
    } as const;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: `Upstream error (${res.status}): ${text.slice(0, 500)}` },
        { status: 200 }
      );
    }

    const data = await res.json();
    // Basic success heuristic: response contains candidates or similar
    const success = !!data;

    return NextResponse.json({ ok: success, details: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 200 });
  }
}