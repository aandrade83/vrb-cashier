import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAllMethodsWithFields } from "@/data/methods";
import { PlayersView } from "./_components/PlayersView";

export default async function AdminPlayersPage() {
  const { sessionClaims } = await auth();

  if (sessionClaims?.public_metadata?.role !== "admin") {
    redirect("/");
  }

  const methods = await getAllMethodsWithFields();
  const deposits = methods.filter((m) => m.type === "deposit");
  const payouts = methods.filter((m) => m.type === "payout");

  return <PlayersView deposits={deposits} payouts={payouts} />;
}
