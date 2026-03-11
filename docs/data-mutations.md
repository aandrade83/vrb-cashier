# Data Mutations Standards

## Data Helper Functions

All database mutations MUST be encapsulated in helper functions located in the `/data` directory (e.g. `src/data/workouts.ts`).

- Do **not** write database mutations inline inside components, server actions, or anywhere outside of `/data`.
- Do **not** use raw SQL. All mutations MUST use **[Drizzle ORM](https://orm.drizzle.team/)**.
- Mutation helpers live in the same `/data` files as query helpers for the same domain.

### Example structure

```
src/
  data/
    workouts.ts   ← query + mutation helpers for workouts
    exercises.ts  ← query + mutation helpers for exercises
```

### Example helpers

```ts
// src/data/workouts.ts
import { db } from "@/db";
import { workouts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function createWorkout(userId: string, name: string, date: Date) {
  return db.insert(workouts).values({ userId, name, date }).returning();
}

export async function deleteWorkout(userId: string, workoutId: string) {
  return db
    .delete(workouts)
    .where(eq(workouts.id, workoutId), eq(workouts.userId, userId));
}
```

## Server Actions

All data mutations MUST be performed via Next.js Server Actions.

- Do **not** mutate data from client components directly.
- Do **not** use Next.js Route Handlers (`src/app/api/`) for mutations.
- Server actions MUST be defined in colocated `actions.ts` files, placed next to the route/page that uses them.

### Example structure

```
src/
  app/
    dashboard/
      create-workout/
        page.tsx
        actions.ts   ← server actions for this route
```

### Typing

All server action parameters MUST be explicitly typed. Do **not** use `FormData` as a parameter type.

```ts
// ✅ Correct
export async function createWorkoutAction(data: CreateWorkoutInput) { ... }

// ❌ Wrong
export async function createWorkoutAction(formData: FormData) { ... }
```

### Validation

ALL server actions MUST validate their arguments using **[Zod](https://zod.dev/)** before performing any operation.

```ts
// src/app/dashboard/create-workout/actions.ts
"use server";

import { z } from "zod";
import { createWorkout } from "@/data/workouts";
import { auth } from "@/auth";

const createWorkoutSchema = z.object({
  name: z.string().min(1),
  date: z.date(),
});

type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

export async function createWorkoutAction(data: CreateWorkoutInput) {
  const parsed = createWorkoutSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  return createWorkout(session.user.id, parsed.data.name, parsed.data.date);
}
```

### Redirects

Do **not** call `redirect()` inside server actions. Redirects MUST be handled client-side after the server action resolves.

```ts
// ✅ Correct — redirect in the client component after the action
const router = useRouter();

async function handleSubmit() {
  await createWorkoutAction(data);
  router.push("/dashboard");
}

// ❌ Wrong — redirect inside the server action
export async function createWorkoutAction(data: CreateWorkoutInput) {
  await createWorkout(...);
  redirect("/dashboard"); // do not do this
}
```

## Data Access Security

**A logged-in user MUST only ever be able to mutate their own data.**

- Every mutation helper in `/data` that operates on user-owned data MUST scope the operation to the authenticated user's ID (e.g. include a `userId` filter on `update`/`delete` calls).
- The `userId` passed to a helper MUST always come from the authenticated session (e.g. from Auth.js `auth()`), never from user-supplied input such as request bodies or URL params.
- Failing to enforce this would constitute a broken access control vulnerability.
