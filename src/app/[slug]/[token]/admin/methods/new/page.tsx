import { CreateMethodForm } from "@/app/(admin)/admin/methods/new/create-method-form";

export default async function CashierNewMethodPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const successRedirect = `/${slug}/${token}/admin/methods`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Create Payment Method</h1>
      <CreateMethodForm successRedirect={successRedirect} />
    </div>
  );
}
