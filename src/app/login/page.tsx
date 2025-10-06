"use client"

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Code2 } from "lucide-react";
import { toast } from "sonner";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session?.user) {
      const redirect = searchParams.get("redirect") || "/";
      router.replace(redirect);
    }
  }, [session, isPending, router, searchParams]);

  const handleGoogleSignIn = async () => {
    try {
      const redirect = searchParams.get("redirect") || "/";
      const { error } = await authClient.signIn.social({
        provider: "google",
      });
      if (error?.code) {
        toast.error("Google sign-in failed");
        return;
      }
      router.push(redirect);
    } catch (e) {
      toast.error("Unable to start Google sign-in");
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-xl border-2">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center mb-4">
            <Code2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Sign in to continue with Google
          </p>
        </div>

        {/* Official-like Google button */}
        <Button
          onClick={handleGoogleSignIn}
          size="lg"
          className="w-full bg-white text-black hover:bg-white/90 border border-input shadow-sm"
          variant="outline"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 533.5 544.3" aria-hidden="true">
            <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.7-36.3-5-53.4H272v101h146.9c-6.3 34.1-25.3 63-54 82.3v68h87.1c51-47 81.5-116.2 81.5-197.9z"/>
            <path fill="#34A853" d="M272 544.3c73.7 0 135.6-24.4 180.8-66.1l-87.1-68c-24.2 16.3-55.2 26-93.7 26-71.9 0-132.8-48.5-154.6-113.8H27.2v71.6C72.2 497.3 166.1 544.3 272 544.3z"/>
            <path fill="#FBBC05" d="M117.4 322.4c-10.6-31.9-10.6-66.4 0-98.3V152.5H27.2c-40.5 80.9-40.5 176.3 0 257.2l90.2-87.3z"/>
            <path fill="#EA4335" d="M272 106.1c39.9-.6 77.8 14.6 106.8 42.7l79.6-79.6C407.6 24 343.7-.1 272 0 166.1 0 72.2 47 27.2 152.5l90.2 71.6C139.2 154.6 200.1 106.1 272 106.1z"/>
          </svg>
          Sign in with Google
        </Button>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          By continuing, you agree to our Terms and acknowledge our Privacy Policy.
        </p>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}