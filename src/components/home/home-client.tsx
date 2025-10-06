"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Download, Code2, Settings, FolderKanban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
// import { authClient, useSession } from "@/lib/auth-client";
// import Link from "next/link";
// import { toast } from "sonner";
// import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const HomeClient = () => {
  const [projectDescription, setProjectDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const router = useRouter();

  // Phase One: AI Settings modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>("gemini-2.5-pro");
  const [verifyStatus, setVerifyStatus] = useState<"idle"|"verifying"|"success"|"error">("idle");
  const [verifyMessage, setVerifyMessage] = useState<string>("");

  // Transition confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    // Prefill from storage
    try {
      const storedKey = localStorage.getItem("ai.apiKey");
      const storedModel = localStorage.getItem("ai.model");
      if (storedKey) setApiKey(storedKey);
      if (storedModel) setModel(storedModel);
    } catch {}
  }, []);

  const handleSaveAndActivate = async () => {
    setVerifyStatus("verifying");
    setVerifyMessage("Verifying key…");
    try {
      const res = await fetch("/api/ai/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model }),
      });
      const data = await res.json();
      if (data?.ok) {
        setVerifyStatus("success");
        setVerifyMessage("Key active and ready to use.");
        // Persist
        try {
          localStorage.setItem("ai.apiKey", apiKey);
          localStorage.setItem("ai.model", model);
        } catch {}
        // Auto-close after 2s
        setTimeout(() => {
          setAiModalOpen(false);
          setVerifyStatus("idle");
          setVerifyMessage("");
        }, 2000);
      } else {
        setVerifyStatus("error");
        setVerifyMessage(`Activation failed: ${data?.error || "Unknown error"}`);
      }
    } catch (e: any) {
      setVerifyStatus("error");
      setVerifyMessage(`Activation failed: ${e?.message || "Unknown error"}`);
    }
  };

  // Phase One flow: instead of immediately generating, ask to proceed then go to workspace
  const handleBuildClick = () => {
    if (!projectDescription.trim()) return;
    setConfirmOpen(true);
  };

  const proceedToWorkspace = () => {
    setConfirmOpen(false);
    // Pass idea to IDE; the IDE can use it to create a plan
    const idea = encodeURIComponent(projectDescription.trim());
    router.push(`/ide?idea=${idea}`);
  };

  // ... keep existing generation handlers in case they're needed elsewhere
  const handleGenerateProject = async () => {
    if (!projectDescription.trim()) return;

    setIsGenerating(true);
    setIsComplete(false);
    setCurrentProjectId(null);

    try {
      const createResponse = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: projectDescription.substring(0, 100),
          description: projectDescription,
          status: "generating",
        }),
      });

      if (!createResponse.ok) {
        throw new Error("Failed to create project record");
      }

      const projectRecord = await createResponse.json();
      setCurrentProjectId(projectRecord.id);

      const response = await fetch("/api/generate-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: projectDescription }),
      });

      if (!response.ok) {
        await fetch(`/api/projects/${projectRecord.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "failed" }),
        });
        throw new Error("Failed to generate project");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setIsComplete(true);

      await fetch(`/api/projects/${projectRecord.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "completed",
          fileUrl: url,
        }),
      });
    } catch (error) {
      console.error("Error generating project:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">The Smart Engineer</h1>
              <p className="text-xs text-muted-foreground">for Full Integration</p>
            </div>
          </div>

          {/* Phase One toolbar */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAiModalOpen(true)}>
              <Settings className="h-4 w-4 mr-2" /> AI Settings
            </Button>
            <Button variant="outline" size="sm" disabled>
              <FolderKanban className="h-4 w-4 mr-2" /> My Projects
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            AI-Powered Development Platform
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Turn Your Idea into an App</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Write a description of the app or website you want to create in simple language. 
            Our AI will build the basic structure for you.
          </p>
        </div>

        <Card className="p-6 md:p-8 shadow-xl border-2">
          <div className="space-y-6">
            <div>
              <label htmlFor="project-description" className="block text-sm font-medium mb-2">
                Describe Your Project
              </label>
              <Textarea
                id="project-description"
                placeholder="Example: Create a task management app with user authentication, the ability to create, edit, and delete tasks, and a dashboard showing task statistics..."
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="min-h-[200px] text-base resize-none"
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Be as detailed as possible. Include features, design preferences, and any specific requirements.
              </p>
            </div>

            <Button
              onClick={handleBuildClick}
              disabled={!projectDescription.trim()}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              Build My Project
            </Button>

            {isGenerating && (
              <Card className="p-6 bg-muted/50 border-dashed animate-pulse">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Analyzing idea and generating code...</p>
                    <p className="text-sm text-muted-foreground">This may take a few moments</p>
                  </div>
                </div>
              </Card>
            )}

            {isComplete && downloadUrl && (
              <Card className="p-6 bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg mb-1">Project Generated Successfully!</p>
                    <p className="text-sm text-muted-foreground">Your project is ready to download</p>
                  </div>
                  <Button onClick={() => {
                    if (downloadUrl) {
                      const a = document.createElement("a");
                      a.href = downloadUrl;
                      a.download = "generated-project.zip";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  }} className="w-full md:w-auto" size="lg">
                    <Download className="mr-2 h-5 w-5" />
                    Download Project (.zip)
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </Card>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Code2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Full Stack Ready</h3>
            <p className="text-sm text-muted-foreground">Complete React + TypeScript frontend and Node.js + Express backend</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">AI-Powered</h3>
            <p className="text-sm text-muted-foreground">Leverages Google Gemini AI to understand your requirements and generate code</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Instant Download</h3>
            <p className="text-sm text-muted-foreground">Get a complete project structure ready for deployment</p>
          </Card>
        </div>
      </main>

      {/* AI Settings Modal */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>AI Settings</DialogTitle>
            <DialogDescription>Provide your API key and select a model.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter your Gemini API key" autoComplete="off" />
            </div>
            <div className="grid gap-2">
              <Label>Select AI Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={
                  "inline-block h-2.5 w-2.5 rounded-full " +
                  (verifyStatus === "idle" ? "bg-muted-foreground/40" : verifyStatus === "verifying" ? "bg-yellow-500" : verifyStatus === "success" ? "bg-green-500" : "bg-red-500")
                }
              />
              <span className="text-muted-foreground">
                {verifyStatus === "idle" && "Waiting"}
                {verifyStatus === "verifying" && "Verifying key…"}
                {verifyStatus === "success" && verifyMessage}
                {verifyStatus === "error" && verifyMessage}
              </span>
            </div>
            <Button onClick={handleSaveAndActivate} disabled={!apiKey || verifyStatus === "verifying"}>
              Save & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Alert Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proceed to Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              I'll now create a plan for your project. Would you like to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={proceedToWorkspace}>Yes, proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};