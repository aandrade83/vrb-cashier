// =============================================================================
// Cashier Context — Server-side helpers to read cashier from request headers.
// The middleware injects x-cashier-id and x-cashier-slug into every request
// that matches /{slug}/{token}/*.
// =============================================================================

import { headers } from "next/headers";
import { db } from "@/db";
import { cashiers } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Cashier } from "@/db/schema";

export const CASHIER_ID_HEADER = "x-cashier-id";
export const CASHIER_SLUG_HEADER = "x-cashier-slug";
export const CASHIER_TOKEN_HEADER = "x-cashier-token";

// Seed VRB cashier ID — used as fallback for legacy routes not yet migrated.
export const VRB_CASHIER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

/**
 * Get the cashier ID injected by middleware.
 * Use this in Server Components and Server Actions.
 * Never accept cashierId from user input.
 * Falls back to VRB cashier ID for legacy routes.
 */
export async function getCashierId(): Promise<string> {
  const headerStore = await headers();
  const cashierId = headerStore.get(CASHIER_ID_HEADER);

  if (!cashierId) {
    // Legacy routes not yet migrated to /{slug}/{token}/* use the VRB default
    return VRB_CASHIER_ID;
  }

  return cashierId;
}

/**
 * Get full cashier record from the injected header.
 */
export async function getCashier(): Promise<Cashier> {
  const cashierId = await getCashierId();

  const [cashier] = await db
    .select()
    .from(cashiers)
    .where(eq(cashiers.id, cashierId))
    .limit(1);

  if (!cashier) {
    throw new Error(`Cashier ${cashierId} not found.`);
  }

  return cashier;
}

/**
 * Resolve the base path for links within a cashier context.
 * Returns /{slug}/{token}
 */
export async function getCashierBasePath(): Promise<string> {
  const headerStore = await headers();
  const slug = headerStore.get(CASHIER_SLUG_HEADER);
  const token = headerStore.get(CASHIER_TOKEN_HEADER);

  if (!slug || !token) {
    throw new Error("No cashier context found in headers.");
  }

  return `/${slug}/${token}`;
}
