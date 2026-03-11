# Data Fetching Standards

## Server Components Only

**All data fetching MUST be done exclusively via React Server Components.**

- Do **not** fetch data in client components (no `useEffect` fetches, no SWR, no React Query, etc.).
- Do **not** use Next.js Route Handlers (`src/app/api/`) for data fetching.
- Do **not** use any other data fetching mechanism (REST calls from the client, tRPC, etc.).
- The only acceptable pattern is calling data helper functions directly inside a Server Component.

## Data Helper Functions

All database queries MUST be encapsulated in helper functions located in the `/data` directory (e.g. `src/data/workouts.ts`).

- Do **not** write database queries inline inside components or anywhere outside of `/data`.
- Do **not** use raw SQL. All queries MUST use **[Drizzle ORM](https://orm.drizzle.team/)**.

### Example structure

```
src/
  data/
    workouts.ts   ← query helpers for workouts
    exercises.ts  ← query helpers for exercises
```

### Example helper

```ts
// src/data/workouts.ts
import { db } from "@/db";
import { workouts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getWorkoutsForUser(userId: string) {
  return db.select().from(workouts).where(eq(workouts.userId, userId));
}
```

### Example usage in a Server Component

```tsx
// src/app/dashboard/page.tsx
import { getWorkoutsForUser } from "@/data/workouts";

export default async function DashboardPage() {
  const workouts = await getWorkoutsForUser(userId);
  return <div>...</div>;
}
```

## Data Access Security

**A logged-in user MUST only ever be able to access their own data.**

- Every query helper in `/data` that returns user-owned data MUST filter by the authenticated user's ID.
- Never write a query that returns all rows without a `userId` filter on user-owned tables.
- The `userId` passed to a helper MUST always come from the authenticated session (e.g. from Auth.js `auth()`), never from user-supplied input such as URL params or request bodies.
- Failing to enforce this would constitute a broken access control vulnerability.
