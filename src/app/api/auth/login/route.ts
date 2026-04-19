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

  // Resolve cashier from slug + token
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

  // Rate limit check
  const allowed = await checkLoginRateLimit(cashierId, username);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 }
    );
  }

  // Look up user
  const [user] = await db
    .select()
    .from(cashierUsers)
    .where(and(eq(cashierUsers.cashierId, cashierId), eq(cashierUsers.username, username)))
    .limit(1);

  if (user) {
    const passwordMatch = await verifyPassword(password, user.passwordHash);

    if (passwordMatch) {
      if (!user.isActive) {
        await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "user_inactive" });
        return NextResponse.json({ error: "Account is inactive" }, { status: 401 });
      }

      await logLoginAttempt({ cashierId, username, ipAddress, success: true });
      await createUserSession(user.id, cashierId, user.role);

      const redirect = user.role === "player"
        ? buildPath(cashierSlug, cashierToken, "player", "dashboard")
        : buildPath(cashierSlug, cashierToken, user.role);
      return NextResponse.json({ redirect });
    }

    // Password mismatch — only players get sportsbook fallback
    if (user.role !== "player") {
      await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "wrong_password" });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Case A3: player found, wrong password → try sportsbook
    const result = await validateSportsbookCredentials(username, password);

    if (result.success) {
      const newHash = await hashPassword(password);
      await db.update(cashierUsers).set({ passwordHash: newHash }).where(eq(cashierUsers.id, user.id));

      if (!user.isActive) {
        await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "user_inactive", sportsbookChecked: true });
        return NextResponse.json({ error: "Account is inactive" }, { status: 401 });
      }

      await logLoginAttempt({ cashierId, username, ipAddress, success: true, sportsbookChecked: true });
      await createUserSession(user.id, cashierId, "player");

      const redirect = buildPath(cashierSlug, cashierToken, "player", "dashboard");
      return NextResponse.json({ redirect });
    }

    if (result.reason === "invalid_credentials") {
      await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "sportsbook_invalid", sportsbookChecked: true });
      return NextResponse.json(
        { error: "Sportsbook credentials are not valid. Please verify them on the sportsbook site." },
        { status: 401 }
      );
    }

    await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "sportsbook_error", sportsbookChecked: true });
    return NextResponse.json(
      { error: "Could not connect to sportsbook. Please try again later." },
      { status: 503 }
    );
  }

  // Case A2: user not found → validate against sportsbook
  const result = await validateSportsbookCredentials(username, password);

  if (result.success) {
    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(cashierUsers)
      .values({ cashierId, username, passwordHash, role: "player" })
      .returning();

    await logLoginAttempt({ cashierId, username, ipAddress, success: true, sportsbookChecked: true });
    await createUserSession(newUser.id, cashierId, "player");

    const redirect = buildPath(cashierSlug, cashierToken, "player", "dashboard");
    return NextResponse.json({ redirect });
  }

  if (result.reason === "invalid_credentials") {
    await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "sportsbook_invalid", sportsbookChecked: true });
    return NextResponse.json(
      { error: "Sportsbook credentials are not valid. Please verify them on the sportsbook site." },
      { status: 401 }
    );
  }

  await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "sportsbook_error", sportsbookChecked: true });
  return NextResponse.json(
    { error: "Could not connect to sportsbook. Please try again later." },
    { status: 503 }
  );
}
