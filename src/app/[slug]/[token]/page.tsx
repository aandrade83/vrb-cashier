import { redirect } from "next/navigation";

export default async function CashierHomePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  redirect(`/${slug}/${token}/sign-in`);
}
