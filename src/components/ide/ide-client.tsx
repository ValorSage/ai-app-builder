"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Download, 
  Play, 
  Share2, 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Send, 
  AlertTriangle,
  FileText,
  Eye,
  Settings,
  Monitor,
  Smartphone,
  Tablet,
  Tv
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted">
      <div className="text-sm text-muted-foreground">Loading editor...</div>
    </div>
  )
});

type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
};

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

type Message = {
  role: "system" | "assistant" | "user";
  content: string;
  ts: number;
};

type ViewMode = "files" | "preview";

type DeviceSize = {
  name: string;
  width: number;
  height: number;
  icon: any;
};

const DEVICE_SIZES: DeviceSize[] = [
  { name: "Desktop", width: 1920, height: 1080, icon: Monitor },
  { name: "Laptop", width: 1366, height: 768, icon: Monitor },
  { name: "Tablet", width: 768, height: 1024, icon: Tablet },
  { name: "Mobile", width: 375, height: 667, icon: Smartphone },
  { name: "TV", width: 1920, height: 1080, icon: Tv },
];

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
  const [activeContent, setActiveContent] = useState<string>("// Select a file to view its content\n");
  const [projectName, setProjectName] = useState<string>("My Project");
  const [viewMode, setViewMode] = useState<ViewMode>("files");
  
  // AI and messaging
  const [chat, setChat] = useState<Message[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Preview
  const [previewUrl, setPreviewUrl] = useState("http://localhost:3001");
  const [selectedDevice, setSelectedDevice] = useState<DeviceSize>(DEVICE_SIZES[0]);
  const [previewKey, setPreviewKey] = useState(0);
  
  // Issues
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesCount, setIssuesCount] = useState(0);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch("/api/ide/files");
      const data = await res.json();
      setTree(data.tree || []);
    } catch (e) {
      console.error("Failed to fetch tree:", e);
    }
  }, []);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch("/api/issues");
      const data = await res.json();
      setIssues(data.issues || []);
      setIssuesCount(data.count || 0);
    } catch (e) {
      console.error("Failed to fetch issues:", e);
    }
  }, []);

  useEffect(() => {
    fetchTree();
    fetchIssues();
    
    // Poll for issues every 30 seconds
    const interval = setInterval(fetchIssues, 30000);
    return () => clearInterval(interval);
  }, [fetchTree, fetchIssues]);

  const expandParentFolders = (filePath: string) => {
    const parts = filePath.split("/");
    const newExpanded = { ...expanded };
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      newExpanded[currentPath] = true;
    }
    setExpanded(newExpanded);
  };

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

  const handleSaveFile = async () => {
    if (!activePath) return;
    try {
      const res = await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activePath, content: activeContent }),
      });
      if (res.ok) {
        toast.success("File saved");
        // Trigger preview reload
        setPreviewKey(prev => prev + 1);
      } else {
        toast.error("Failed to save file");
      }
    } catch (e) {
      toast.error(`Save error: ${e}`);
    }
  };

  const handleAgentCommand = async () => {
    const text = assistantInput.trim();
    if (!text) return;
    
    setChat((c) => [...c, { role: "user", content: text, ts: Date.now() }]);
    setAssistantInput("");
    setIsSending(true);

    try {
      const apiKey = localStorage.getItem("ai.apiKey") || "";
      const model = localStorage.getItem("ai.model") || "gpt-4";

      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: text, apiKey, model }),
      });

      const data = await res.json();

      if (!res.ok) {
        setChat((c) => [...c, { role: "assistant", content: `❌ ${data.error || "Unknown error"}`, ts: Date.now() }]);
        return;
      }

      // Display message
      setChat((c) => [...c, { role: "assistant", content: data.message || "✓ Done", ts: Date.now() }]);

      // Handle specific actions
      if (data.action === "CREATE_FILE" || data.action === "EDIT_FILE") {
        await fetchTree();
        if (data.created) {
          expandParentFolders(data.created);
          await openFile(data.created);
        }
        if (data.edited && activePath === data.edited) {
          await openFile(data.edited);
        }
        setPreviewKey(prev => prev + 1);
      }

      if (data.action === "DELETE_FILE") {
        await fetchTree();
        if (activePath === data.deleted) {
          setActivePath("");
          setActiveContent("// File deleted. Select another file.\n");
        }
        setPreviewKey(prev => prev + 1);
      }

      if (data.action === "ANALYZE_CODE") {
        if (data.issues && data.issues.length > 0) {
          // Store AI issues
          await fetch("/api/issues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              issues: data.issues.map((issue: any, idx: number) => ({
                id: `ai-${data.analyzed}-${issue.line}-${idx}`,
                type: "ai",
                severity: issue.type === "bug" ? "error" : issue.type === "warning" ? "warning" : "info",
                file: data.analyzed,
                line: issue.line,
                message: issue.message,
                suggestion: issue.suggestion
              }))
            }),
          });
          await fetchIssues();

          const issuesList = data.issues.map((i: any) => 
            `• Line ${i.line}: ${i.message} (${i.suggestion})`
          ).join("\n");
          setChat((c) => [...c, { role: "assistant", content: `📊 Found ${data.issues.length} issue(s):\n\n${issuesList}`, ts: Date.now() }]);
        } else {
          setChat((c) => [...c, { role: "assistant", content: "✓ No issues found", ts: Date.now() }]);
        }
      }

      if (data.action === "INSTALL_PACKAGE" || data.action === "UNINSTALL_PACKAGE") {
        if (data.needsExecution) {
          // Execute package install/uninstall
          const pkgRes = await fetch("/api/packages/install", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              package: data.package, 
              action: data.action === "INSTALL_PACKAGE" ? "install" : "uninstall" 
            }),
          });
          
          if (pkgRes.ok) {
            setChat((c) => [...c, { role: "assistant", content: `✓ Package ${data.package} ${data.action === "INSTALL_PACKAGE" ? "installed" : "uninstalled"}`, ts: Date.now() }]);
          } else {
            const pkgData = await pkgRes.json();
            setChat((c) => [...c, { role: "assistant", content: `❌ Package operation failed: ${pkgData.error}`, ts: Date.now() }]);
          }
        }
      }

      if (data.action === "LIST_FILES" && data.files) {
        const filesList = data.files.slice(0, 50).join("\n• ");
        setChat((c) => [...c, { role: "assistant", content: `📁 Files (showing ${Math.min(50, data.files.length)}/${data.files.length}):\n\n• ${filesList}`, ts: Date.now() }]);
      }

    } catch (e: any) {
      setChat((c) => [...c, { role: "assistant", content: `❌ ${e?.message || String(e)}`, ts: Date.now() }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownload = async () => {
    toast.info("Preparing download...");
    try {
      const encodedName = encodeURIComponent(projectName);
      const res = await fetch(`/api/ide/download?name=${encodedName}`);
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Download failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success("Project downloaded");
    } catch (e: any) {
      toast.error(`Download error: ${e?.message || String(e)}`);
    }
  };

  const handleIssueClick = (issue: Issue) => {
    openFile(issue.file);
    toast.info(`Navigating to ${issue.file}:${issue.line}`);
  };

  const toggle = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const language = useMemo(() => detectLanguage(activePath), [activePath]);

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
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="h-9 w-[200px] md:w-[280px]"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {issuesCount > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      {issuesCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[400px] max-h-[400px] overflow-auto">
                {issues.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No issues found
                  </div>
                ) : (
                  issues.map((issue) => (
                    <DropdownMenuItem
                      key={issue.id}
                      onClick={() => handleIssueClick(issue)}
                      className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Badge
                          variant={issue.severity === "error" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {issue.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate flex-1">
                          {issue.file}:{issue.line}
                        </span>
                      </div>
                      <div className="text-sm">{issue.message}</div>
                      {issue.suggestion && (
                        <div className="text-xs text-muted-foreground">💡 {issue.suggestion}</div>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleSaveFile} disabled={!activePath}>
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
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

      {/* Sub-header Toolbar */}
      <div className="border-b bg-muted/30 px-4 py-2 flex items-center gap-2">
        <Button
          variant={viewMode === "files" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setViewMode("files")}
        >
          <FileText className="h-4 w-4 mr-1" />
          Files
        </Button>
        <Button
          variant={viewMode === "preview" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setViewMode("preview")}
        >
          <Eye className="h-4 w-4 mr-1" />
          Preview
        </Button>
      </div>

      {/* Three Panel Layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left: File Explorer or Preview */}
        <ResizablePanel defaultSize={viewMode === "preview" ? 60 : 22} minSize={16} maxSize={80}>
          <div className="h-full flex flex-col">
            {viewMode === "files" ? (
              <>
                <div className="px-3 py-2 font-medium text-sm text-muted-foreground">File Explorer</div>
                <Separator />
                <ScrollArea className="flex-1 p-2">
                  <FileTree nodes={tree} />
                </ScrollArea>
              </>
            ) : (
              <>
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <span className="font-medium text-sm text-muted-foreground">Live Preview</span>
                  <Select
                    value={selectedDevice.name}
                    onValueChange={(name) => {
                      const device = DEVICE_SIZES.find(d => d.name === name);
                      if (device) setSelectedDevice(device);
                    }}
                  >
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEVICE_SIZES.map((device) => (
                        <SelectItem key={device.name} value={device.name}>
                          <div className="flex items-center gap-2">
                            <device.icon className="h-4 w-4" />
                            {device.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 overflow-auto bg-muted/20 p-4 flex items-center justify-center">
                  <div
                    className="bg-background border-2 border-border shadow-xl rounded-lg overflow-hidden"
                    style={{
                      width: `${Math.min(selectedDevice.width, window.innerWidth * 0.9)}px`,
                      height: `${Math.min(selectedDevice.height, window.innerHeight * 0.7)}px`,
                    }}
                  >
                    <iframe
                      key={previewKey}
                      src={previewUrl}
                      className="w-full h-full border-0"
                      title="Live Preview"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Center: Monaco Editor */}
        <ResizablePanel defaultSize={viewMode === "preview" ? 18 : 56} minSize={20}>
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

        {/* Right: AI Assistant */}
        <ResizablePanel defaultSize={22} minSize={18} maxSize={40} className="border-l">
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b font-medium text-sm text-muted-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              AI Assistant
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {chat.length === 0 ? (
                  <Card className="p-3 text-sm text-muted-foreground">
                    <div className="font-medium mb-2">💡 Available Commands:</div>
                    <div className="space-y-1 text-xs">
                      <div>• "Create a Button component"</div>
                      <div>• "Analyze src/app/page.tsx"</div>
                      <div>• "Install axios"</div>
                      <div>• "List all files"</div>
                    </div>
                  </Card>
                ) : (
                  chat.map((m, idx) => (
                    <Card key={idx} className="p-3 text-sm">
                      <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                        <span className="font-medium capitalize">{m.role}</span>
                        <span>{new Date(m.ts).toLocaleTimeString()}</span>
                      </div>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAgentCommand();
              }}
              className="border-t p-2 flex items-center gap-2"
            >
              <Input
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                placeholder="Ask AI to create, analyze, or install..."
                disabled={isSending}
                className="h-9"
              />
              <Button type="submit" size="sm" disabled={isSending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default IdeClient;