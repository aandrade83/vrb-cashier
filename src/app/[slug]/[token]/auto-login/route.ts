import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cashiers, cashierUsers, externalLoginTokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createUserSession } from "@/lib/auth/session";
import { buildPath } from "@/lib/paths";
import { getAppUrl } from "@/lib/app-url";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token } = await params;
  const otp = req.nextUrl.searchParams.get("otp");

  const invalid = () =>
    NextResponse.redirect(new URL(`/${slug}/${token}/sign-in`, getAppUrl()));

  if (!otp) return invalid();

  // ── Validate OTP ──────────────────────────────────────────────────────────
  const [record] = await db
    .select()
    .from(externalLoginTokens)
    .where(eq(externalLoginTokens.token, otp))
    .limit(1);

  if (!record || record.used || record.expiresAt <= new Date()) return invalid();

  // Confirm the OTP belongs to the cashier in the URL
  const [cashier] = await db
    .select({ id: cashiers.id })
    .from(cashiers)
    .where(and(eq(cashiers.slug, slug), eq(cashiers.token, token), eq(cashiers.isActive, true)))
    .limit(1);

  if (!cashier || cashier.id !== record.cashierId) return invalid();

  // Confirm the user still exists and is active
  const [user] = await db
    .select({ id: cashierUsers.id, isActive: cashierUsers.isActive })
    .from(cashierUsers)
    .where(eq(cashierUsers.id, record.userId))
    .limit(1);

  if (!user || !user.isActive) return invalid();

  // ── Mark token as used (atomic — prevents replay) ─────────────────────────
  const [updated] = await db
    .update(externalLoginTokens)
    .set({ used: true })
    .where(and(eq(externalLoginTokens.id, record.id), eq(externalLoginTokens.used, false)))
    .returning({ id: externalLoginTokens.id });

  // If another request already consumed this token, abort
  if (!updated) return invalid();

  // ── Create session cookie + redirect to dashboard ─────────────────────────
  await createUserSession(user.id, cashier.id, "player");

  const dashboard = buildPath(slug, token, "player", "dashboard");
  return NextResponse.redirect(new URL(dashboard, getAppUrl()));
}
