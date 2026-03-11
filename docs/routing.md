# Routing Coding Standards

## Route Structure

All application routes live under `/dashboard`.

- The root `/` and auth routes (`/sign-in`, `/sign-up`) are the only public routes.
- Every feature page must be nested under `/dashboard` (e.g. `/dashboard/workout/new`).
- Do **not** create top-level routes for app features outside of `/dashboard`.

## Route Protection

All `/dashboard` routes (and any sub-routes) are **protected** — they require the user to be authenticated.

Route protection is handled exclusively via **Next.js middleware** (`src/middleware.ts`). Do **not** implement redirect logic inside individual pages, layouts, or server actions to guard routes.

See `/docs/auth.md` for the middleware implementation using Clerk.

## Public Routes

The following routes are public (no authentication required):

- `/` — landing/home page
- `/sign-in` and `/sign-up` — Clerk auth pages

All other routes are protected by default.

## File-System Conventions

- Use the App Router (`src/app/`) for all routes.
- Dashboard pages go in `src/app/dashboard/`.
- Dynamic segments use bracket notation: `src/app/dashboard/workout/[workoutId]/`.
- Each route segment should have a `page.tsx` and optionally a `layout.tsx`.
- Co-locate route-specific components and server actions alongside the `page.tsx` they belong to — do **not** place them in a shared directory unless they are reused across multiple routes.
