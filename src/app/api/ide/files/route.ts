import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Minimal, curated tree for MVP. Matches real files where possible.
  const tree = [
    {
      name: "src",
      path: "src",
      type: "folder",
      children: [
        {
          name: "app",
          path: "src/app",
          type: "folder",
          children: [
            { name: "page.tsx", path: "src/app/page.tsx", type: "file" },
            { name: "layout.tsx", path: "src/app/layout.tsx", type: "file" },
            {
              name: "ide",
              path: "src/app/ide",
              type: "folder",
              children: [{ name: "page.tsx", path: "src/app/ide/page.tsx", type: "file" }],
            },
            {
              name: "api",
              path: "src/app/api",
              type: "folder",
              children: [
                {
                  name: "ide",
                  path: "src/app/api/ide",
                  type: "folder",
                  children: [
                    { name: "files", path: "src/app/api/ide/files", type: "folder" },
                    { name: "file", path: "src/app/api/ide/file", type: "folder" },
                    { name: "plan", path: "src/app/api/ide/plan", type: "folder" },
                  ],
                },
              ],
            },
          ],
        },
        {
          name: "components",
          path: "src/components",
          type: "folder",
          children: [
            {
              name: "ide",
              path: "src/components/ide",
              type: "folder",
              children: [{ name: "ide-client.tsx", path: "src/components/ide/ide-client.tsx", type: "file" }],
            },
          ],
        },
      ],
    },
    {
      name: "public",
      path: "public",
      type: "folder",
      children: [],
    },
    { name: "package.json", path: "package.json", type: "file" },
    { name: "tsconfig.json", path: "tsconfig.json", type: "file" },
    { name: "next.config.ts", path: "next.config.ts", type: "file" },
  ];

  return NextResponse.json({ tree });
}