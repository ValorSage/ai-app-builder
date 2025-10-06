import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import archiver from "archiver";

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    // Initialize Google Gemini with API key
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Generate project structure using Google Gemini
    const result = await model.generateContent(`You are an expert full-stack software engineer. Generate a complete project structure with actual working code based on the user's description. 

The project should include:
1. Frontend: React + TypeScript with modern hooks and components
2. Backend: Node.js + Express.js with RESTful API endpoints
3. Package.json files for both frontend and backend
4. README.md with setup instructions

Return ONLY a valid JSON object with this structure:
{
  "projectName": "kebab-case-name",
  "files": [
    {
      "path": "frontend/src/App.tsx",
      "content": "actual file content here"
    }
  ]
}

Generate complete, working code that can be run immediately after npm install. Include all necessary imports, proper TypeScript types, error handling, and modern best practices.

User Request: ${description}`);

    const response = await result.response;
    const responseText = response.text();
    
    if (!responseText) {
      throw new Error("No response from Gemini");
    }

    // Extract JSON from response (in case it's wrapped in markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    // Parse the AI response
    const projectData = JSON.parse(jsonText);

    // Create a zip file
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    // Set up the response as a stream
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

        // Add files to the archive
        projectData.files.forEach((file: { path: string; content: string }) => {
          archive.append(file.content, { name: file.path });
        });

        // Finalize the archive
        archive.finalize();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${projectData.projectName || "generated-project"}.zip"`,
      },
    });
  } catch (error) {
    console.error("Error generating project:", error);
    return NextResponse.json(
      { error: "Failed to generate project", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}