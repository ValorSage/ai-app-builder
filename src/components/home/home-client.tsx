"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Download, Code2, User, LogOut, LayoutDashboard } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const HomeClient = () => {
  const [projectDescription, setProjectDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const { data: session, isPending, refetch } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    const { error } = await authClient.signOut();
    if (error?.code) {
      toast.error("Failed to sign out");
    } else {
      localStorage.removeItem("bearer_token");
      refetch();
      router.push("/");
      toast.success("Signed out successfully");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const redirect = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
      const { error } = await authClient.signIn.social({
        provider: "google",
      });
      if (error?.code) {
        toast.error("Google sign-in failed");
        return;
      }
      if (redirect) router.push(redirect);
    } catch (e) {
      toast.error("Unable to start Google sign-in");
    }
  };

  const handleGenerateProject = async () => {
    if (!projectDescription.trim()) return;

    if (!session?.user) {
      toast.error("Please log in to generate projects");
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setIsGenerating(true);
    setIsComplete(false);
    setCurrentProjectId(null);

    try {
      const token = localStorage.getItem("bearer_token");

      const createResponse = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
            Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "completed",
          fileUrl: url,
        }),
      });

      toast.success("Project generated successfully!");
    } catch (error) {
      console.error("Error generating project:", error);
      toast.error("Failed to generate project. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "generated-project.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Project downloaded!");
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

          <div className="flex items-center gap-3">
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : session?.user ? (
              <>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">{session.user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{session.user.name}</span>
                        <span className="text-xs text-muted-foreground">{session.user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button onClick={handleGoogleSignIn} size="sm" variant="outline" className="bg-white text-black border-input hover:bg-white/90">
                <svg className="mr-2 h-4 w-4" viewBox="0 0 533.5 544.3" aria-hidden="true">
                  <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.7-36.3-5-53.4H272v101h146.9c-6.3 34.1-25.3 63-54 82.3v68h87.1c51-47 81.5-116.2 81.5-197.9z"/>
                  <path fill="#34A853" d="M272 544.3c73.7 0 135.6-24.4 180.8-66.1l-87.1-68c-24.2 16.3-55.2 26-93.7 26-71.9 0-132.8-48.5-154.6-113.8H27.2v71.6C72.2 497.3 166.1 544.3 272 544.3z"/>
                  <path fill="#FBBC05" d="M117.4 322.4c-10.6-31.9-10.6-66.4 0-98.3V152.5H27.2c-40.5 80.9-40.5 176.3 0 257.2l90.2-87.3z"/>
                  <path fill="#EA4335" d="M272 106.1c39.9-.6 77.8 14.6 106.8 42.7l79.6-79.6C407.6 24 343.7-.1 272 0 166.1 0 72.2 47 27.2 152.5l90.2 71.6C139.2 154.6 200.1 106.1 272 106.1z"/>
                </svg>
                Sign in with Google
              </Button>
            )}
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
              onClick={handleGenerateProject}
              disabled={!projectDescription.trim() || isGenerating}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Build Project 🚀</>
              )}
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
                  <Button onClick={handleDownload} className="w-full md:w-auto" size="lg">
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
    </div>
  );
};