// =============================================================================
// VRB Cashier — Proxy (Next.js middleware, Node.js runtime)
//
// Route hierarchy:
//   /master/*                    → Cookie-presence gate; DB validation in pages
//   /{slug}/{token}/sign-in      → Public; redirect if already authenticated
//   /{slug}/{token}/admin/*      → Requires admin role (or master acting)
//   /{slug}/{token}/clerk/*      → Requires clerk role
//   /{slug}/{token}/player/*     → Requires player role
//   /api/auth/*, /api/master/*   → Public
//   /cashier-inactive, /         → Public
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import {
  CASHIER_ID_HEADER,
  CASHIER_SLUG_HEADER,
  CASHIER_TOKEN_HEADER,
} from "@/lib/cashier-context";
import { USER_SESSION_COOKIE, MASTER_SESSION_COOKIE } from "@/lib/auth/constants";

// ---------------------------------------------------------------------------
// In-memory cashier cache — survives across warm Edge invocations
// ---------------------------------------------------------------------------

interface CachedCashier {
  id: string;
  slug: string;
  token: string;
  isActive: boolean;
  cachedAt: number;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const cashierCache = new Map<string, CachedCashier>();
const CACHE_TTL_MS = 60_000;

async function resolveCashier(slug: string, token: string): Promise<CachedCashier | null> {
  const cacheKey = `${slug}:${token}`;
  const cached = cashierCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached;

  try {
    const result = await pool.query(
      "SELECT id, slug, token, is_active FROM cashiers WHERE slug = $1 AND token = $2 LIMIT 1",
      [slug, token],
    );
    if (!result.rows[0]) return null;

    const entry: CachedCashier = {
      id: result.rows[0].id as string,
      slug: result.rows[0].slug as string,
      token: result.rows[0].token as string,
      isActive: result.rows[0].is_active as boolean,
      cachedAt: Date.now(),
    };
    cashierCache.set(cacheKey, entry);
    return entry;
  } catch {
    return null;
  }
}

async function validateUserSession(
  token: string,
): Promise<{ valid: boolean; userId?: string; cashierId?: string; role?: string }> {
  try {
    const result = await pool.query(
      "SELECT user_id, cashier_id, role FROM user_sessions WHERE token = $1 AND expires_at > NOW() LIMIT 1",
      [token],
    );
    if (!result.rows[0]) return { valid: false };
    return {
      valid: true,
      userId: result.rows[0].user_id as string,
      cashierId: result.rows[0].cashier_id as string,
      role: result.rows[0].role as string,
    };
  } catch {
    return { valid: false };
  }
}

function homeForRole(role: string, slug: string, token: string): string {
  if (role === "admin") return `/${slug}/${token}/admin/dashboard`;
  if (role === "clerk") return `/${slug}/${token}/clerk/queue`;
  return `/${slug}/${token}/player/dashboard`;
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ------------------------------------------------------------------
  // 1. Fully public routes
  // ------------------------------------------------------------------
  if (
    pathname === "/" ||
    pathname === "/cashier-inactive" ||
    pathname === "/pending" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/master/") ||
    pathname.startsWith("/api/cashier/") ||
    pathname.startsWith("/api/cashier-lookup") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/upload") ||
    pathname.startsWith("/api/migrate") ||
    pathname.startsWith("/dev/")
  ) {
    return NextResponse.next();
  }

  // ------------------------------------------------------------------
  // 2. Master routes — cookie-presence gate only
  // ------------------------------------------------------------------
  if (pathname.startsWith("/master")) {
    if (pathname === "/master/login") return NextResponse.next();

    const hasCookie = !!req.cookies.get(MASTER_SESSION_COOKIE)?.value;
    if (!hasCookie) {
      return NextResponse.redirect(new URL("/master/login", req.url));
    }
    return NextResponse.next();
  }

  // ------------------------------------------------------------------
  // 3. Cashier routes — /{slug}/{token}/...
  // ------------------------------------------------------------------
  const cashierRouteMatch = /^\/([^/]+)\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!cashierRouteMatch) return NextResponse.next();

  const slug = cashierRouteMatch[1];
  const token = cashierRouteMatch[2];
  const rest = cashierRouteMatch[3] ?? "/";

  const cashier = await resolveCashier(slug, token);
  if (!cashier) return NextResponse.redirect(new URL("/", req.url));
  if (!cashier.isActive) return NextResponse.redirect(new URL("/cashier-inactive", req.url));

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CASHIER_ID_HEADER, cashier.id);
  requestHeaders.set(CASHIER_SLUG_HEADER, cashier.slug);
  requestHeaders.set(CASHIER_TOKEN_HEADER, cashier.token);

  // Sign-in page — public, redirect if already authenticated
  if (rest === "/sign-in" || rest.startsWith("/sign-in/")) {
    const sessionToken = req.cookies.get(USER_SESSION_COOKIE)?.value;
    if (sessionToken) {
      const sessionData = await validateUserSession(sessionToken);
      if (sessionData.valid && sessionData.cashierId === cashier.id && sessionData.role) {
        return NextResponse.redirect(
          new URL(homeForRole(sessionData.role, slug, token), req.url),
        );
      }
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const roleRequired = rest.startsWith("/admin")
    ? "admin"
    : rest.startsWith("/clerk")
    ? "clerk"
    : rest.startsWith("/player")
    ? "player"
    : null;

  if (!roleRequired) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Master impersonating — cookie presence is enough; pages do full DB validation
  const masterToken = req.cookies.get(MASTER_SESSION_COOKIE)?.value;
  if (masterToken) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const sessionToken = req.cookies.get(USER_SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.redirect(new URL(`/${slug}/${token}/sign-in`, req.url));
  }

  const sessionData = await validateUserSession(sessionToken);
  if (!sessionData.valid) {
    const response = NextResponse.redirect(new URL(`/${slug}/${token}/sign-in`, req.url));
    response.cookies.delete(USER_SESSION_COOKIE);
    return response;
  }

  if (sessionData.cashierId !== cashier.id) {
    return NextResponse.redirect(new URL(`/${slug}/${token}/sign-in`, req.url));
  }

  if (!sessionData.role) {
    return NextResponse.redirect(new URL(`/${slug}/${token}/sign-in`, req.url));
  }

  if (sessionData.role !== roleRequired) {
    return NextResponse.redirect(
      new URL(homeForRole(sessionData.role, slug, token), req.url),
    );
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
