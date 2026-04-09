// =============================================================================
// VRB Cashier — Middleware
//
// Route hierarchy:
//   /master/*                    → Master auth (no Clerk), session cookie
//   /{slug}/{token}/admin/*      → Clerk auth, admin role
//   /{slug}/{token}/clerk/*      → Clerk auth, clerk role
//   /{slug}/{token}/player/*     → Clerk auth, player role
//   /sign-in, /sign-up, etc.     → Public
//
// The middleware validates the cashier (slug + token) and injects
// x-cashier-id, x-cashier-slug, x-cashier-token into request headers
// so Server Components can read the tenant without trusting URL params.
// =============================================================================

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { CASHIER_ID_HEADER, CASHIER_SLUG_HEADER, CASHIER_TOKEN_HEADER } from "@/lib/cashier-context";
import { MASTER_SESSION_COOKIE } from "@/lib/master-auth";

// ---------------------------------------------------------------------------
// Route matchers
// ---------------------------------------------------------------------------

const isMasterRoute = createRouteMatcher(["/master(.*)"]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pending",
  "/api/webhooks/(.*)",
  "/api/register-player",
  "/api/check-role",
]);

// Cashier routes: /{slug}/{token}/{role}/...
const isCashierAdminRoute = createRouteMatcher(["/:slug/:token/admin(.*)"]);
const isCashierClerkRoute = createRouteMatcher(["/:slug/:token/clerk(.*)"]);
const isCashierPlayerRoute = createRouteMatcher(["/:slug/:token/player(.*)"]);
const isCashierRoute = createRouteMatcher(["/:slug/:token(.*)"]);

// ---------------------------------------------------------------------------
// In-memory cashier cache (avoids DB hit on every request)
// In production, use edge KV store. For now a simple Map with 60s TTL.
// ---------------------------------------------------------------------------

interface CachedCashier {
  id: string;
  slug: string;
  isActive: boolean;
  cachedAt: number;
}

const cashierCache = new Map<string, CachedCashier>();
const CACHE_TTL_MS = 60_000; // 60 seconds

async function resolveCashier(
  slug: string,
  token: string
): Promise<CachedCashier | null> {
  const cacheKey = `${slug}:${token}`;
  const cached = cashierCache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  // Direct DB query — middleware runs on Edge, use fetch to hit internal API
  // to avoid importing drizzle (which requires Node.js runtime).
  // We use the internal validation endpoint.
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/cashier/validate?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as { id: string; slug: string; isActive: boolean };

    if (!data.id) return null;

    const entry: CachedCashier = { ...data, cachedAt: Date.now() };
    cashierCache.set(cacheKey, entry);
    return entry;
  } catch {
    return null;
  }
}

function homeForRole(role: string, slug: string, token: string): string {
  if (role === "admin") return `/${slug}/${token}/admin/dashboard`;
  if (role === "clerk") return `/${slug}/${token}/clerk/queue`;
  return `/${slug}/${token}/player/deposits`;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const url = req.nextUrl;

  // ------------------------------------------------------------------
  // 1. Master routes — independent session auth, no Clerk
  // ------------------------------------------------------------------
  if (isMasterRoute(req)) {
    if (url.pathname === "/master/login") {
      return NextResponse.next();
    }

    const sessionToken = req.cookies.get(MASTER_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      return NextResponse.redirect(new URL("/master/login", req.url));
    }

    // Validate master session via internal API (Edge-safe)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const res = await fetch(
        `${baseUrl}/api/master/validate-session?token=${encodeURIComponent(sessionToken)}`,
        { next: { revalidate: 0 } }
      );

      if (!res.ok) {
        const response = NextResponse.redirect(new URL("/master/login", req.url));
        response.cookies.delete(MASTER_SESSION_COOKIE);
        return response;
      }
    } catch {
      return NextResponse.redirect(new URL("/master/login", req.url));
    }

    return NextResponse.next();
  }

  // ------------------------------------------------------------------
  // 2. Public routes
  // ------------------------------------------------------------------
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // ------------------------------------------------------------------
  // 3. Cashier routes — validate slug + token, inject headers
  // ------------------------------------------------------------------
  if (isCashierRoute(req)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const slug = segments[0];
    const token = segments[1];

    if (!slug || !token) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const cashier = await resolveCashier(slug, token);

    if (!cashier || !cashier.isActive) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Inject cashier context into request headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(CASHIER_ID_HEADER, cashier.id);
    requestHeaders.set(CASHIER_SLUG_HEADER, cashier.slug);
    requestHeaders.set(CASHIER_TOKEN_HEADER, token);

    // Now enforce Clerk auth + role for the specific sub-route
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    const role = (sessionClaims?.public_metadata as { role?: string } | undefined)?.role;

    if (!role) {
      return NextResponse.redirect(new URL("/pending", req.url));
    }

    // Block cross-role access
    if (isCashierAdminRoute(req) && role !== "admin") {
      return NextResponse.redirect(new URL(homeForRole(role, slug, token), req.url));
    }
    if (isCashierClerkRoute(req) && role !== "clerk") {
      return NextResponse.redirect(new URL(homeForRole(role, slug, token), req.url));
    }
    if (isCashierPlayerRoute(req) && role !== "player") {
      return NextResponse.redirect(new URL(homeForRole(role, slug, token), req.url));
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ------------------------------------------------------------------
  // 4. Any other route — require Clerk auth
  // ------------------------------------------------------------------
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
