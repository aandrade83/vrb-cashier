export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { MasterClerkNav } from "@/components/master-clerk-nav";

export default async function ClerkReportsPage() {
  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");
  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");
  if (session.role === "master_admin") redirect("/master/dashboard");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterClerkNav active="reports" />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Reports</h1>
          <p className="text-muted-foreground text-sm">Coming soon.</p>
        </div>
      </main>
    </div>
  );
}
