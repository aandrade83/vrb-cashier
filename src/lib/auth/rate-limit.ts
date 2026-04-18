import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { and, eq, gt, count, sql } from "drizzle-orm";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 10;

export async function checkLoginRateLimit(
  cashierId: string,
  username: string
): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

  const [{ value }] = await db
    .select({ value: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.cashierId, cashierId),
        eq(loginAttempts.username, username),
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, windowStart)
      )
    );

  return Number(value) < RATE_LIMIT_MAX_FAILURES;
}

export async function logLoginAttempt(data: {
  cashierId: string;
  username: string;
  ipAddress?: string;
  success: boolean;
  failureReason?: string;
  sportsbookChecked?: boolean;
}): Promise<void> {
  await db.insert(loginAttempts).values({
    cashierId: data.cashierId,
    username: data.username,
    ipAddress: data.ipAddress ?? null,
    success: data.success,
    failureReason: data.failureReason ?? null,
    sportsbookChecked: data.sportsbookChecked ?? false,
  });
}
