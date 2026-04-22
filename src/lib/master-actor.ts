"use server";

import { db } from "@/db";
import { cashierUsers, masterUsers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getMasterSession } from "./auth/session";

export type CashierActor = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  masterRole: "master_admin" | "master_clerk" | null;
};

const SHADOW_PREFIX = "__m__";

/**
 * Resolves or auto-creates a shadow cashierUsers row for the currently
 * acting master user inside the given cashier.
 *
 * Shadow rows use username "__m__<masterUsername>" so they are:
 *  - unique per cashier (uniqueIndex on cashierId+username)
 *  - never usable for normal login (passwordHash = "!disabled")
 *  - identifiable by the __m__ prefix
 *
 * Returns null if the current session is not a master acting in this cashier.
 */
export async function getOrCreateCashierActor(
  cashierId: string,
): Promise<CashierActor | null> {
  const masterSession = await getMasterSession();
  if (!masterSession || masterSession.actingCashierId !== cashierId) return null;

  let masterUsername: string;
  let masterRole: "master_admin" | "master_clerk";
  let displayName: string;

  if (!masterSession.masterUserId) {
    masterUsername = "root";
    masterRole = "master_admin";
    displayName = "ENV Root";
  } else {
    const [mu] = await db
      .select({ username: masterUsers.username, role: masterUsers.role })
      .from(masterUsers)
      .where(eq(masterUsers.id, masterSession.masterUserId))
      .limit(1);
    if (!mu) return null;
    masterUsername = mu.username;
    masterRole = mu.role as "master_admin" | "master_clerk";
    displayName = mu.username;
  }

  const shadowUsername = `${SHADOW_PREFIX}${masterUsername}`;
  const cashierRole = masterRole === "master_admin" ? "admin" : "clerk";

  // Look up existing shadow user
  const [existing] = await db
    .select({
      id: cashierUsers.id,
      username: cashierUsers.username,
      firstName: cashierUsers.firstName,
      lastName: cashierUsers.lastName,
      role: cashierUsers.role,
    })
    .from(cashierUsers)
    .where(and(eq(cashierUsers.cashierId, cashierId), eq(cashierUsers.username, shadowUsername)))
    .limit(1);

  if (existing) {
    return { ...existing, masterRole };
  }

  // Create shadow user — passwordHash "!disabled" never matches any bcrypt verify
  const [created] = await db
    .insert(cashierUsers)
    .values({
      cashierId,
      username: shadowUsername,
      passwordHash: "!disabled",
      role: cashierRole as "admin" | "clerk",
      firstName: displayName,
      lastName: null,
      isActive: true,
    })
    .returning({
      id: cashierUsers.id,
      username: cashierUsers.username,
      firstName: cashierUsers.firstName,
      lastName: cashierUsers.lastName,
      role: cashierUsers.role,
    });

  console.log("[master-actor] Created shadow cashierUser id=%s username=%s cashierId=%s", created.id, created.username, cashierId);

  return { ...created, masterRole };
}
