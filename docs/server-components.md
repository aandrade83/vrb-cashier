# Server Components Coding Standards

## Params and SearchParams

In Next.js 16, `params` and `searchParams` are **Promises** and MUST be awaited before accessing their values.

- Do **not** access `params` or `searchParams` synchronously.
- Always `await` them at the top of the component before use.

```tsx
// ✅ Correct
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;
  // ...
}

// ❌ Wrong — params is a Promise, not a plain object
export default async function Page({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params; // do not do this
}
```

## Type Signatures

Always type `params` and `searchParams` as `Promise<...>` in the function signature.

```tsx
// ✅ Correct
{ params }: { params: Promise<{ workoutId: string }> }

// ❌ Wrong
{ params }: { params: { workoutId: string } }
```
