# UI Coding Standards

## Component Library

**All UI must be built exclusively with [shadcn/ui](https://ui.shadcn.com/) components.**

- Do **not** create custom UI components under any circumstances.
- Do **not** use any other component library (e.g. MUI, Chakra, Radix primitives directly).
- If a shadcn/ui component does not exist for a use case, compose the needed UI from existing shadcn/ui components only.
- Install new shadcn/ui components via the CLI: `npx shadcn@latest add <component>`

## Date Formatting

Use **[date-fns](https://date-fns.org/)** for all date formatting. No other date utility library should be used.

### Format

Dates must be formatted using ordinal day, abbreviated month, and full year:

```
1st Sep 2025
2nd Aug 2025
3rd Jan 2026
4th Jun 2024
```

### Implementation

Use the `do MMM yyyy` format token with `date-fns/format`:

```ts
import { format } from "date-fns";

format(date, "do MMM yyyy"); // "1st Sep 2025"
```
