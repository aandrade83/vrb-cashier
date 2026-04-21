/**
 * Helpers for pages that need to work under both real user sessions
 * and master impersonation sessions.
 */
import { getUserSession, getMasterSession } from "./session";
import { getCashierId } from "@/lib/cashier-context";
import type { UserRole } from "./types";

export type CashierPageAccess = {
  userId: string | null;
  cashierId: string;
  role: UserRole;
  isMasterActing: boolean;
};

/**
 * Returns access for the current cashier context, checking both user sessions
 * and master impersonation. Returns null if no valid access exists.
 *
 * Usage in pages:
 *   const access = await getCashierPageAccess(requiredRole);
 *   if (!access) redirect(`/${slug}/${token}/sign-in`);
 */
export async function getCashierPageAccess(
  requiredRole: UserRole,
): Promise<CashierPageAccess | null> {
  const cashierId = await getCashierId();

  // Check real user session first
  const userSession = await getUserSession();
  if (userSession && userSession.cashierId === cashierId && userSession.role === requiredRole) {
    return {
      userId: userSession.userId,
      cashierId,
      role: requiredRole,
      isMasterActing: false,
    };
  }

  // Check master impersonation session
  const masterSession = await getMasterSession();
  if (masterSession && masterSession.actingCashierId === cashierId) {
    const effectiveRole = (masterSession.actingRole as UserRole | undefined) ?? "admin";
    if (effectiveRole === requiredRole) {
      return {
        userId: null,
        cashierId,
        role: requiredRole,
        isMasterActing: true,
      };
    }
  }

  return null;
}

/**
 * Returns true if the current master session is acting within a specific cashier.
 * Used by layouts to decide whether to show the MasterExitButton.
 */
export async function isMasterActingInCashier(): Promise<{
  isActing: boolean;
  actingRole: UserRole | null;
}> {
  const cashierId = await getCashierId();
  const masterSession = await getMasterSession();

  if (!masterSession || masterSession.actingCashierId !== cashierId) {
    return { isActing: false, actingRole: null };
  }

  return {
    isActing: true,
    actingRole: (masterSession.actingRole as UserRole | undefined) ?? "admin",
  };
}
