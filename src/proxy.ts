// =============================================================================
// VRB Cashier — Middleware (internal auth, no Clerk)
//
// Route hierarchy:
//   /master/*                    → Master auth (env credentials + session cookie)
//   /{slug}/{token}/sign-in      → Public (redirect to home if already authenticated)
//   /{slug}/{token}/admin/*      → Requires admin role (or master acting as admin)
//   /{slug}/{token}/clerk/*      → Requires clerk role
//   /{slug}/{token}/player/*     → Requires player role
//   /api/auth/*                  → Public (login/logout endpoints)
//   /api/master/*                → Public (master login/logout/validate)
//   /api/cashier/*               → Public (cashier validation)
//   /api/cron/*                  → Public (cron endpoints)
//   /api/upload                  → Auth enforced inside route handler
//   /cashier-inactive, /         → Public
//
// Cashier resolution: slug + token → cashierId injected via request headers
// so Server Components never trust URL params for tenant identity.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  CASHIER_ID_HEADER,
  CASHIER_SLUG_HEADER,
  CASHIER_TOKEN_HEADER,
} from "@/lib/cashier-context";
import { USER_SESSION_COOKIE, MASTER_SESSION_COOKIE } from "@/lib/auth/constants";

// ---------------------------------------------------------------------------
// In-memory cashier cache — avoids a DB round-trip on every request
// ---------------------------------------------------------------------------

interface CachedCashier {
  id: string;
  slug: string;
  token: string;
  isActive: boolean;
  cachedAt: number;
}

const cashierCache = new Map<string, CachedCashier>();
const CACHE_TTL_MS = 60_000;

async function resolveCashier(
  slug: string,
  token: string,
  baseUrl: string
): Promise<CachedCashier | null> {
  const cacheKey = `${slug}:${token}`;
  const cached = cashierCache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const res = await fetch(
      `${baseUrl}/api/cashier/validate?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      id: string;
      slug: string;
      token: string;
      isActive: boolean;
    };

    if (!data.id) return null;

    const entry: CachedCashier = { ...data, cachedAt: Date.now() };
    cashierCache.set(cacheKey, entry);
    return entry;
  } catch {
    return null;
  }
}

async function validateUserSession(
  token: string,
  baseUrl: string
): Promise<{ valid: boolean; userId?: string; cashierId?: string; role?: string }> {
  try {
    const res = await fetch(
      `${baseUrl}/api/auth/validate-session?token=${encodeURIComponent(token)}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) return { valid: false };
    return (await res.json()) as { valid: boolean; userId?: string; cashierId?: string; role?: string };
  } catch {
    return { valid: false };
  }
}

async function validateMasterSession(
  token: string,
  baseUrl: string
): Promise<{ valid: boolean; actingCashierId?: string | null }> {
  try {
    const res = await fetch(
      `${baseUrl}/api/master/validate-session?token=${encodeURIComponent(token)}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return { valid: false };
    return (await res.json()) as { valid: boolean; actingCashierId?: string | null };
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
// Middleware
// ---------------------------------------------------------------------------

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // ------------------------------------------------------------------
  // 1. Static assets and Next.js internals — pass through
  // ------------------------------------------------------------------
  // (handled by the config matcher — nothing to do here)

  // ------------------------------------------------------------------
  // 2. Fully public routes — no auth required
  // ------------------------------------------------------------------
  if (
    pathname === "/" ||
    pathname === "/cashier-inactive" ||
    pathname === "/pending" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/master/") ||
    pathname.startsWith("/api/cashier/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/upload")
  ) {
    return NextResponse.next();
  }

  // ------------------------------------------------------------------
  // 3. Master routes
  // ------------------------------------------------------------------
  if (pathname.startsWith("/master")) {
    if (pathname === "/master/login") {
      return NextResponse.next();
    }

    const sessionToken = req.cookies.get(MASTER_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      return NextResponse.redirect(new URL("/master/login", req.url));
    }

    const masterResult = await validateMasterSession(sessionToken, baseUrl);
    if (!masterResult.valid) {
      const response = NextResponse.redirect(new URL("/master/login", req.url));
      response.cookies.delete(MASTER_SESSION_COOKIE);
      return response;
    }

    return NextResponse.next();
  }

  // ------------------------------------------------------------------
  // 4. Cashier routes — /{slug}/{token}/...
  // ------------------------------------------------------------------
  const cashierRouteMatch = /^\/([^/]+)\/([^/]+)(\/.*)?$/.exec(pathname);

  if (cashierRouteMatch) {
    const slug = cashierRouteMatch[1];
    const token = cashierRouteMatch[2];
    const rest = cashierRouteMatch[3] ?? "/";

    // Resolve cashier from DB (cached)
    const cashier = await resolveCashier(slug, token, baseUrl);

    if (!cashier) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (!cashier.isActive) {
      return NextResponse.redirect(new URL("/cashier-inactive", req.url));
    }

    // Inject cashier context headers for server components
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(CASHIER_ID_HEADER, cashier.id);
    requestHeaders.set(CASHIER_SLUG_HEADER, cashier.slug);
    requestHeaders.set(CASHIER_TOKEN_HEADER, cashier.token);

    // Sign-in page is public (but redirect if already authenticated)
    if (rest === "/sign-in" || rest.startsWith("/sign-in/")) {
      const sessionToken = req.cookies.get(USER_SESSION_COOKIE)?.value;
      if (sessionToken) {
        const sessionData = await validateUserSession(sessionToken, baseUrl);
        if (sessionData.valid && sessionData.cashierId === cashier.id && sessionData.role) {
          return NextResponse.redirect(
            new URL(homeForRole(sessionData.role, slug, token), req.url)
          );
        }
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // All other cashier routes require authentication
    const roleRequired = rest.startsWith("/admin")
      ? "admin"
      : rest.startsWith("/clerk")
      ? "clerk"
      : rest.startsWith("/player")
      ? "player"
      : null;

    if (!roleRequired) {
      // e.g. /{slug}/{token}/ root page — just resolve cashier, no auth
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Check if master is acting as admin for this cashier
    const masterToken = req.cookies.get(MASTER_SESSION_COOKIE)?.value;
    if (masterToken && roleRequired === "admin") {
      const masterResult = await validateMasterSession(masterToken, baseUrl);
      if (masterResult.valid && masterResult.actingCashierId === cashier.id) {
        return NextResponse.next({ request: { headers: requestHeaders } });
      }
    }

    // Check user session cookie
    const sessionToken = req.cookies.get(USER_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      return NextResponse.redirect(
        new URL(`/${slug}/${token}/sign-in`, req.url)
      );
    }

    const sessionData = await validateUserSession(sessionToken, baseUrl);

    if (!sessionData.valid) {
      const response = NextResponse.redirect(
        new URL(`/${slug}/${token}/sign-in`, req.url)
      );
      response.cookies.delete(USER_SESSION_COOKIE);
      return response;
    }

    // Cross-cashier isolation: session must belong to this cashier
    if (sessionData.cashierId !== cashier.id) {
      return NextResponse.redirect(
        new URL(`/${slug}/${token}/sign-in`, req.url)
      );
    }

    const effectiveRole = sessionData.role;

    if (!effectiveRole) {
      return NextResponse.redirect(
        new URL(`/${slug}/${token}/sign-in`, req.url)
      );
    }

    if (effectiveRole !== roleRequired) {
      return NextResponse.redirect(
        new URL(homeForRole(effectiveRole, slug, token), req.url)
      );
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ------------------------------------------------------------------
  // 5. Anything else — pass through (404 handled by Next.js)
  // ------------------------------------------------------------------
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
