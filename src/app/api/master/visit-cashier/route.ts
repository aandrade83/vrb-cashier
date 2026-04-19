import { NextRequest, NextResponse } from "next/server";
import { getMasterSession, setMasterActingCashier } from "@/lib/auth/session";
import { db } from "@/db";
import { cashiers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await getMasterSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { cashierId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { cashierId } = body;
  if (!cashierId) {
    return NextResponse.json({ error: "cashierId is required" }, { status: 400 });
  }

  const [cashier] = await db
    .select()
    .from(cashiers)
    .where(eq(cashiers.id, cashierId))
    .limit(1);

  if (!cashier || !cashier.isActive) {
    return NextResponse.json({ error: "Cashier not found" }, { status: 404 });
  }

  await setMasterActingCashier(session.sessionToken, cashierId);

  return NextResponse.json({
    redirect: `/${cashier.slug}/${cashier.token}/admin/dashboard`,
  });
}
