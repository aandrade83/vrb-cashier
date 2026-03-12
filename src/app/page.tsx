import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import SignInModal from "@/components/SignInModal";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function homeForRole(role: string): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "clerk") return "/clerk/queue";
  return "/player/deposits";
}

export default async function Home() {
  const user = await currentUser();

  if (user) {
    const role = (user.publicMetadata as { role?: string })?.role;
    redirect(homeForRole(role ?? "player"));
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">VRB Cashier</h1>
        <p className="text-muted-foreground">Secure cashier management system</p>
      </div>
      <div className="flex gap-4">
        <SignInModal />
        <Link href="/sign-up">
          <Button variant="outline">Create Account</Button>
        </Link>
      </div>
    </div>
  );
}
