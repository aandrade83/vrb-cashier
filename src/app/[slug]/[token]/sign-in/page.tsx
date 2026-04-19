import { db } from "@/db";
import { cashiers } from "@/db/schema";
import { getCashierId } from "@/lib/cashier-context";
import { eq } from "drizzle-orm";
import { SignInForm } from "./_components/SignInForm";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const cashierId = await getCashierId();
  const [cashier] = cashierId
    ? await db
        .select({ name: cashiers.name })
        .from(cashiers)
        .where(eq(cashiers.id, cashierId))
        .limit(1)
    : [];

  const cashierName = cashier?.name ?? slug.toUpperCase();

  return <SignInForm slug={slug} token={token} cashierName={cashierName} />;
}
