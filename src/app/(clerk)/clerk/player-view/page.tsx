import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAllActiveMethodsWithFields } from "@/data/methods";
import { VRB_CASHIER_ID } from "@/lib/cashier-context";
import { ClerkPlayerView } from "./_components/ClerkPlayerView";

export default async function ClerkPlayerViewPage() {
  const { sessionClaims } = await auth();

  if (sessionClaims?.public_metadata?.role !== "clerk") {
    redirect("/");
  }

  const methods = await getAllActiveMethodsWithFields(VRB_CASHIER_ID);
  const deposits = methods.filter((m) => m.type === "deposit");
  const payouts = methods.filter((m) => m.type === "payout");

  return <ClerkPlayerView deposits={deposits} payouts={payouts} />;
}
