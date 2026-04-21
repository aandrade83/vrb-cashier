import { NextRequest, NextResponse } from "next/server";
import { getMasterSession, setMasterActingCashier } from "@/lib/auth/session";
import { db } from "@/db";
import { cashiers } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/lib/auth/types";

const VALID_ROLES: UserRole[] = ["admin", "clerk", "player"];

export async function POST(req: NextRequest) {
  const session = await getMasterSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { cashierId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { cashierId, role = "admin" } = body;
  if (!cashierId) {
    return NextResponse.json({ error: "cashierId is required" }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const [cashier] = await db
    .select()
    .from(cashiers)
    .where(eq(cashiers.id, cashierId))
    .limit(1);

  if (!cashier || !cashier.isActive) {
    return NextResponse.json({ error: "Cashier not found or inactive" }, { status: 404 });
  }

  const actingRole = role as UserRole;
  // Store role override in session (null for admin = default behavior)
  await setMasterActingCashier(
    session.sessionToken,
    cashierId,
    actingRole !== "admin" ? actingRole : null,
  );

  const roleRoutes: Record<UserRole, string> = {
    admin: `/${cashier.slug}/${cashier.token}/admin/dashboard`,
    clerk: `/${cashier.slug}/${cashier.token}/clerk/queue`,
    player: `/${cashier.slug}/${cashier.token}/player/dashboard`,
  };

  return NextResponse.json({ redirect: roleRoutes[actingRole] });
}
