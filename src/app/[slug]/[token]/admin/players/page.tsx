import { getAllMethodsWithFields } from "@/data/methods";
import { getCashierId } from "@/lib/cashier-context";
import { PlayersView } from "@/app/(admin)/admin/players/_components/PlayersView";

export default async function CashierAdminPlayersPage() {
  const cashierId = await getCashierId();
  const methods = await getAllMethodsWithFields(cashierId);
  const deposits = methods.filter((m) => m.type === "deposit");
  const payouts = methods.filter((m) => m.type === "payout");

  return <PlayersView deposits={deposits} payouts={payouts} />;
}
