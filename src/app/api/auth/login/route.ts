import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cashiers, cashierUsers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createUserSession } from "@/lib/auth/session";
import { validateSportsbookCredentials } from "@/lib/auth/sportsbook";
import { checkLoginRateLimit, logLoginAttempt } from "@/lib/auth/rate-limit";
import { buildPath } from "@/lib/paths";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string; slug?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const cashierSlug = body.slug?.trim();
  const cashierToken = body.token?.trim();

  if (!cashierSlug || !cashierToken) {
    return NextResponse.json({ error: "Invalid cashier context" }, { status: 400 });
  }

  const [cashier] = await db
    .select({ id: cashiers.id })
    .from(cashiers)
    .where(and(eq(cashiers.slug, cashierSlug), eq(cashiers.token, cashierToken)))
    .limit(1);

  if (!cashier) {
    return NextResponse.json({ error: "Cashier not found" }, { status: 404 });
  }

  const cashierId = cashier.id;
  const rawUsername = body.username?.trim();
  const password = body.password;

  if (!rawUsername || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const username = rawUsername.toLowerCase();
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  const allowed = await checkLoginRateLimit(cashierId, username);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 }
    );
  }

  const [user] = await db
    .select()
    .from(cashierUsers)
    .where(and(eq(cashierUsers.cashierId, cashierId), eq(cashierUsers.username, username)))
    .limit(1);

  // ── Admin / Clerk: local credentials only, no sportsbook ──────────────────
  if (user && user.role !== "player") {
    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "wrong_password" });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.isActive) {
      await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "user_inactive" });
      return NextResponse.json({ error: "Account is inactive" }, { status: 401 });
    }

    await logLoginAttempt({ cashierId, username, ipAddress, success: true });
    await createUserSession(user.id, cashierId, user.role);

    const redirect =
      user.role === "clerk"
        ? buildPath(cashierSlug, cashierToken, "clerk", "queue")
        : buildPath(cashierSlug, cashierToken, user.role, "dashboard");

    return NextResponse.json({ redirect });
  }

  // ── Player: always verify with sportsbook first ────────────────────────────
  const sportsbookResult = await validateSportsbookCredentials(username, password);

  if (!sportsbookResult.success) {
    const reason = sportsbookResult.reason === "invalid_credentials"
      ? "sportsbook_invalid"
      : "sportsbook_error";
    await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: reason, sportsbookChecked: true });

    if (sportsbookResult.reason === "invalid_credentials") {
      return NextResponse.json(
        { error: "Invalid credentials. Please verify them on the sportsbook site." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Could not connect to sportsbook. Please try again later." },
      { status: 503 }
    );
  }

  // Sportsbook verified — sync player in local DB
  if (user) {
    // Update stored password hash if it changed
    const samePassword = await verifyPassword(password, user.passwordHash);
    if (!samePassword) {
      const newHash = await hashPassword(password);
      await db
        .update(cashierUsers)
        .set({ passwordHash: newHash })
        .where(eq(cashierUsers.id, user.id));
    }

    if (!user.isActive) {
      await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "user_inactive", sportsbookChecked: true });
      return NextResponse.json({ error: "Account is inactive" }, { status: 401 });
    }

    await logLoginAttempt({ cashierId, username, ipAddress, success: true, sportsbookChecked: true });
    await createUserSession(user.id, cashierId, "player");
  } else {
    // New player — create record
    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(cashierUsers)
      .values({ cashierId, username, passwordHash, role: "player" })
      .returning();

    await logLoginAttempt({ cashierId, username, ipAddress, success: true, sportsbookChecked: true });
    await createUserSession(newUser.id, cashierId, "player");
  }

  const redirect = buildPath(cashierSlug, cashierToken, "player", "dashboard");
  return NextResponse.json({ redirect });
}
