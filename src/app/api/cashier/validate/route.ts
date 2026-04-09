// Internal API used by middleware to validate cashier slug + token.
// Returns cashier id, slug, and isActive.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cashiers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get("slug");
  const token = searchParams.get("token");

  if (!slug || !token) {
    return NextResponse.json({ error: "Missing slug or token" }, { status: 400 });
  }

  const [cashier] = await db
    .select({ id: cashiers.id, slug: cashiers.slug, isActive: cashiers.isActive })
    .from(cashiers)
    .where(and(eq(cashiers.slug, slug), eq(cashiers.token, token)))
    .limit(1);

  if (!cashier) {
    return NextResponse.json({ error: "Cashier not found" }, { status: 404 });
  }

  return NextResponse.json(cashier);
}
