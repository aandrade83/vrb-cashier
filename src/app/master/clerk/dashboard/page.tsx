export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function ClerkDashboardPage() {
  redirect("/master/clerk/queue");
}
