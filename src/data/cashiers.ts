// =============================================================================
// Cashier data helpers — queries and mutations for the cashiers table.
// Used only from master routes. Never exposed to tenant users.
// =============================================================================

import { db } from "@/db";
import { cashiers } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Cashier, NewCashier } from "@/db/schema";

export async function getAllCashiers(): Promise<Cashier[]> {
  return db.select().from(cashiers).orderBy(cashiers.createdAt);
}

export async function getCashierById(id: string): Promise<Cashier | null> {
  const [cashier] = await db
    .select()
    .from(cashiers)
    .where(eq(cashiers.id, id))
    .limit(1);
  return cashier ?? null;
}

export async function getCashierBySlugAndToken(
  slug: string,
  token: string
): Promise<Cashier | null> {
  const { and } = await import("drizzle-orm");
  const [cashier] = await db
    .select()
    .from(cashiers)
    .where(and(eq(cashiers.slug, slug), eq(cashiers.token, token)))
    .limit(1);
  return cashier ?? null;
}

export async function createCashier(
  data: Omit<NewCashier, "id" | "createdAt">
): Promise<Cashier> {
  const [cashier] = await db.insert(cashiers).values(data).returning();
  return cashier;
}

export async function updateCashier(
  id: string,
  data: Partial<Pick<Cashier, "name" | "logoUrl" | "contactEmail" | "contactPhone" | "isActive">>
): Promise<Cashier> {
  const [cashier] = await db
    .update(cashiers)
    .set(data)
    .where(eq(cashiers.id, id))
    .returning();
  return cashier;
}

export async function toggleCashierActive(id: string): Promise<Cashier> {
  const current = await getCashierById(id);
  if (!current) throw new Error(`Cashier ${id} not found`);

  const [updated] = await db
    .update(cashiers)
    .set({ isActive: !current.isActive })
    .where(eq(cashiers.id, id))
    .returning();

  return updated;
}
