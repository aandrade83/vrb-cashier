import { notFound } from "next/navigation";
import { getMethodById } from "@/data/methods";
import { EditMethodForm } from "./edit-method-form";

export default async function EditMethodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const method = await getMethodById(id);

  if (!method) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit Payment Method</h1>
      <EditMethodForm method={method} />
    </div>
  );
}
