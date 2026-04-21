import { isMasterAuthenticated } from "@/lib/master-auth";
import { redirect } from "next/navigation";
import { getAllCashiers } from "@/data/cashiers";
import { NewCashierForm } from "./new-cashier-form";

export default async function NewCashierPage() {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  const cashiers = await getAllCashiers();
  const existingCashiers = cashiers.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">New Cashier</h1>
          <p className="text-muted-foreground text-sm">Create a new tenant cashier</p>
        </div>
        <NewCashierForm existingCashiers={existingCashiers} />
      </div>
    </div>
  );
}
