import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-xl border-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Registration Temporarily Disabled</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Google sign-up is temporarily unavailable while we update our domain settings. You can continue using the app without creating an account.
        </p>
        <Link href="/">
          <Button className="w-full">Go to Home</Button>
        </Link>
      </Card>
    </div>
  );
}