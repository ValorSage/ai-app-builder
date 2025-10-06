"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Download, Play, Share2, Folder, File, ChevronRight, ChevronDown, Bot, Settings, ClipboardList } from "lucide-react";

// Monaco must be dynamically imported on client
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
};

function detectLanguage(path: string): string {
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".md")) return "markdown";
  return "plaintext";
}

export const IdeClient = () => {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activePath, setActivePath] = useState<string>("");
  const [activeContent, setActiveContent] = useState<string>("// Select a file from the left to view its content\n");
  const [projectName, setProjectName] = useState<string>("My Project");

  // Right panel state
  const [rightTab, setRightTab] = useState<string>("assistant");
  const [idea, setIdea] = useState<string>("");
  const [plan, setPlan] = useState<string[]>([]);
  const [chat, setChat] = useState<{ role: "system" | "assistant" | "user"; content: string; ts: number }[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    const fetchTree = async () => {
      const res = await fetch("/api/ide/files");
      const data = await res.json();
      setTree(data.tree || []);
    };
    fetchTree();
  }, []);

  const openFile = async (path: string) => {
    setActivePath(path);
    try {
      const res = await fetch(`/api/ide/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("Failed to read file");
      const data = await res.json();
      setActiveContent(data.content ?? "");
    } catch (e) {
      setActiveContent(`// Unable to read file: ${path}\n// ${String(e)}`);
    }
  };

  const toggle = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const language = useMemo(() => detectLanguage(activePath), [activePath]);

  const handleMakePlan = async () => {
    if (!idea.trim()) return;
    setIsPlanning(true);
    setRightTab("plan");
    try {
      const res = await fetch("/api/ide/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      setPlan(data.plan || []);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleConfirmExecute = async () => {
    if (!plan.length) return;
    setIsExecuting(true);
    setRightTab("assistant");

    // Simulate execution logs and live updates
    const steps = plan;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setChat((c) => [
        ...c,
        { role: "assistant", content: `Planned: ${step}` , ts: Date.now() },
      ]);
      // Simulate a created/edited message
      await new Promise((r) => setTimeout(r, 400));
      const createdMsg = step.replace(/^Create /i, "Created ").replace(/^Add /i, "Added ");
      setChat((c) => [
        ...c,
        { role: "assistant", content: createdMsg, ts: Date.now() },
      ]);

      // Example: Add a sample file to tree reactively on first step
      if (i === 0) {
        setTree((prev) => {
          const cloned = structuredClone(prev) as FileNode[];
          // try to locate src/app
          const src = cloned.find((n) => n.name === "src");
          if (src && src.children) {
            const app = src.children.find((n) => n.name === "app");
            if (app && app.children) {
              app.children.push({ name: "demo.ts", path: "src/app/demo.ts", type: "file" });
            }
          }
          return cloned;
        });
      }
    }
    setIsExecuting(false);
  };

  const FileTree: React.FC<{ nodes: FileNode[]; depth?: number }> = ({ nodes, depth = 0 }) => {
    return (
      <div className="space-y-1">
        {nodes.map((node) => {
          const pad = { paddingLeft: `${depth * 12}px` } as React.CSSProperties;
          if (node.type === "folder") {
            const isOpen = !!expanded[node.path];
            return (
              <div key={node.path}>
                <button
                  className="w-full flex items-center gap-2 rounded px-2 py-1 hover:bg-accent text-left"
                  style={pad}
                  onClick={() => toggle(node.path)}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Folder className="h-4 w-4 text-primary" />
                  <span className="truncate">{node.name}</span>
                </button>
                {isOpen && node.children?.length ? (
                  <FileTree nodes={node.children} depth={depth + 1} />
                ) : null}
              </div>
            );
          }
          return (
            <button
              key={node.path}
              className={`w-full flex items-center gap-2 rounded px-2 py-1 hover:bg-accent text-left ${
                activePath === node.path ? "bg-accent" : ""
              }`}
              style={pad}
              onClick={() => openFile(node.path)}
            >
              <File className="h-4 w-4" />
              <span className="truncate">{node.name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-[calc(100dvh)] w-full flex flex-col">
      {/* Top Toolbar */}
      <div className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center justify-between px-3 md:px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="h-9 w-[200px] md:w-[280px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <Play className="h-4 w-4 mr-1" />
              Run / Preview
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button variant="ghost" size="sm">
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Three Panel Layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left: File Explorer */}
        <ResizablePanel defaultSize={22} minSize={16} maxSize={40} className="min-w-[180px]">
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 font-medium text-sm text-muted-foreground">File Explorer</div>
            <Separator />
            <ScrollArea className="flex-1 p-2">
              <FileTree nodes={tree} />
            </ScrollArea>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Center: Monaco Editor */}
        <ResizablePanel defaultSize={56} minSize={35}>
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b text-sm flex items-center gap-2">
              <span className="truncate">{activePath || "No file selected"}</span>
            </div>
            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                language={language}
                theme="vs-dark"
                value={activeContent}
                onChange={(v) => setActiveContent(v ?? "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                }}
              />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Right: Tabs */}
        <ResizablePanel defaultSize={22} minSize={18} maxSize={40} className="min-w-[220px] border-l">
          <Tabs value={rightTab} onValueChange={setRightTab} className="h-full flex flex-col">
            <div className="px-3 pt-2">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="assistant" className="text-xs">
                  <Bot className="h-3.5 w-3.5 mr-1" /> AI
                </TabsTrigger>
                <TabsTrigger value="plan" className="text-xs">
                  <ClipboardList className="h-3.5 w-3.5 mr-1" /> Plan
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">
                  <Settings className="h-3.5 w-3.5 mr-1" /> Settings
                </TabsTrigger>
              </TabsList>
            </div>
            <Separator className="mt-2" />
            <div className="flex-1 min-h-0">
              <TabsContent value="assistant" className="m-0 h-full">
                <ScrollArea className="h-full p-3 space-y-2">
                  {chat.length === 0 ? (
                    <Card className="p-3 text-sm text-muted-foreground">Use the Plan tab to generate a plan, then Confirm to see live execution logs here.</Card>
                  ) : (
                    chat.map((m, idx) => (
                      <Card key={idx} className="p-3 text-sm">
                        <div className="text-xs text-muted-foreground">{new Date(m.ts).toLocaleTimeString()}</div>
                        <div>{m.content}</div>
                      </Card>
                    ))
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="plan" className="m-0 h-full">
                <div className="h-full flex flex-col p-3 gap-3">
                  <Textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="Describe your project idea..."
                    className="min-h-[90px]"
                    disabled={isPlanning || isExecuting}
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={handleMakePlan} disabled={!idea.trim() || isPlanning} size="sm">
                      {isPlanning ? "Planning..." : "Build Plan"}
                    </Button>
                    <Button variant="secondary" onClick={handleConfirmExecute} disabled={!plan.length || isExecuting} size="sm">
                      {isExecuting ? "Executing..." : "Confirm & Start Execution"}
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    {plan.length ? (
                      <ol className="list-decimal pl-5 space-y-1 text-sm">
                        {plan.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ol>
                    ) : (
                      <div className="text-sm text-muted-foreground">Your plan will appear here.</div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>
              <TabsContent value="settings" className="m-0 h-full">
                <div className="p-3 text-sm space-y-3">
                  <div className="font-medium">Settings</div>
                  <div className="text-muted-foreground">Manage API keys and preferences here (coming soon).</div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default IdeClient;