import { redirect } from "next/navigation";
import { getMethodWithFields } from "@/data/methods";
import { getCashierId } from "@/lib/cashier-context";
import { EditMethodForm } from "@/app/(admin)/admin/methods/[id]/edit/edit-method-form";
import { hasNameListForMethod } from "@/data/name-lists";

export default async function CashierEditMethodPage({
  params,
}: {
  params: Promise<{ slug: string; token: string; id: string }>;
}) {
  const { slug, token, id } = await params;
  const cashierId = await getCashierId();
  const base = `/${slug}/${token}/admin`;

  const method = await getMethodWithFields(id, cashierId);
  if (!method) {
    redirect(`${base}/methods`);
  }

  const [successRedirect, hasList] = [
    `${base}/methods?type=${method.type}`,
    await hasNameListForMethod(id),
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit Method</h1>
      <EditMethodForm method={method} successRedirect={successRedirect} hasNameList={hasList} />
    </div>
  );
}
