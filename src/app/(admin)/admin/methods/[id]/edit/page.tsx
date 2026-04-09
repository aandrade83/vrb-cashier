import { notFound } from "next/navigation";
import { getMethodById } from "@/data/methods";
import { EditMethodForm } from "./edit-method-form";
import { VRB_CASHIER_ID } from "@/lib/cashier-context";

export default async function EditMethodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const method = await getMethodById(id, VRB_CASHIER_ID);

  if (!method) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit Payment Method</h1>
      <EditMethodForm method={method} />
    </div>
  );
}
