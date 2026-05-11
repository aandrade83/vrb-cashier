import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cashiers, cashierUsers, externalLoginTokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logLoginAttempt } from "@/lib/auth/rate-limit";
import { randomBytes } from "crypto";
import { getAppUrl } from "@/lib/app-url";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function normalizeHostname(raw: string): string {
  const s = raw.trim().toLowerCase();
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return s.replace(/^www\./, "");
  }
}

export async function POST(req: NextRequest) {
  // ── API key auth ─────────────────────────────────────────────────────────
  const expectedKey = process.env.EXTERNAL_LOGIN_API_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { error: "Service not configured" },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  const providedKey = req.headers.get("x-api-key");
  if (!providedKey || providedKey !== expectedKey) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { site?: string; username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const site = body.site?.trim();
  const rawUsername = body.username?.trim();
  const password = body.password;

  if (!site || !rawUsername || !password) {
    return NextResponse.json(
      { error: "site, username and password are required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const username = rawUsername.toLowerCase();

  // ── Find cashier by site domain ───────────────────────────────────────────
  const normalizedSite = normalizeHostname(site);

  const activeCashiers = await db
    .select({
      id: cashiers.id,
      slug: cashiers.slug,
      token: cashiers.token,
      clientUrl: cashiers.clientUrl,
    })
    .from(cashiers)
    .where(eq(cashiers.isActive, true));

  const cashier = activeCashiers.find((c) => {
    if (!c.clientUrl) return false;
    return normalizeHostname(c.clientUrl) === normalizedSite;
  });

  if (!cashier) {
    return NextResponse.json(
      { error: "No active cashier found for this site" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const cashierId = cashier.id;
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  // ── Create / update player (sportsbook validation skipped — trusted caller) ─
  const [existingUser] = await db
    .select()
    .from(cashierUsers)
    .where(and(eq(cashierUsers.cashierId, cashierId), eq(cashierUsers.username, username)))
    .limit(1);

  let userId: string;

  if (existingUser) {
    if (!existingUser.isActive) {
      await logLoginAttempt({ cashierId, username, ipAddress, success: false, failureReason: "user_inactive" });
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Keep stored hash in sync
    const samePassword = await verifyPassword(password, existingUser.passwordHash);
    if (!samePassword) {
      const newHash = await hashPassword(password);
      await db
        .update(cashierUsers)
        .set({ passwordHash: newHash })
        .where(eq(cashierUsers.id, existingUser.id));
    }

    userId = existingUser.id;
  } else {
    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(cashierUsers)
      .values({ cashierId, username, passwordHash, role: "player" })
      .returning({ id: cashierUsers.id });

    userId = newUser.id;
  }

  await logLoginAttempt({ cashierId, username, ipAddress, success: true, sportsbookChecked: false });

  // ── Issue one-time login token ────────────────────────────────────────────
  const otp = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(externalLoginTokens).values({ token: otp, cashierId, userId, expiresAt });

  const origin = getAppUrl();
  const autoLoginUrl = `${origin}/${cashier.slug}/${cashier.token}/auto-login?otp=${otp}`;

  return NextResponse.json(
    { url: autoLoginUrl },
    { status: 200, headers: CORS_HEADERS }
  );
}
