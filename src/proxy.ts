import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pending",
  "/api/webhooks/(.*)",
  "/api/register-player",
]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isClerkRoute = createRouteMatcher(["/clerk(.*)"]);
const isPlayerRoute = createRouteMatcher(["/player(.*)"]);

function homeForRole(role: string): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "clerk") return "/clerk/queue";
  return "/player/deposits";
}

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // Public routes: let page.tsx handle redirect for authenticated users on "/"
  if (isPublicRoute(req)) return NextResponse.next();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Role comes from the JWT — requires Clerk JWT template to include public_metadata
  const role = (sessionClaims?.public_metadata as { role?: string } | undefined)?.role;

  if (!role) {
    return NextResponse.redirect(new URL("/pending", req.url));
  }

  // Block cross-role access
  if (isAdminRoute(req) && role !== "admin") {
    return NextResponse.redirect(new URL(homeForRole(role), req.url));
  }
  if (isClerkRoute(req) && role !== "clerk") {
    return NextResponse.redirect(new URL(homeForRole(role), req.url));
  }
  if (isPlayerRoute(req) && role !== "player") {
    return NextResponse.redirect(new URL(homeForRole(role), req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
