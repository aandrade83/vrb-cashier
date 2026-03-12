"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import SignInModal from "@/components/SignInModal";
import Link from "next/link";

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">VRB Cashier</h1>
        <p className="text-muted-foreground">Secure cashier management system</p>
      </div>
      {isLoaded && isSignedIn && <UserButton />}
      {isLoaded && !isSignedIn && (
        <div className="flex gap-4">
          <SignInModal />
          <Link href="/sign-up">
            <Button variant="outline">Create Account</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
