# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test framework is configured yet.



## Docs

**Before writing any code, always read the relevant file(s) in the `/docs` directory first.** The `/docs` directory contains coding standards and conventions that must be followed. Do not generate code that contradicts these standards.

-/docs/ui.md
-/docs/data-fetching.md
-/docs/data-mutations.md
-/docs/auth.md
-/docs/server-components.md
-/docs/routing.md
-/docs/security.md


## Architecture

Next.js 16 app using the App Router (`src/app/`), React 19, TypeScript, and Tailwind CSS v4.

- `src/app/layout.tsx` — Root layout with Geist fonts and metadata
- `src/app/page.tsx` — Home page
- `src/app/globals.css` — Global styles (Tailwind v4 with `@import "tailwindcss"`)

**Path alias:** `@/*` maps to `./src/*`

**ESLint** uses the flat config format (`eslint.config.mjs`) with Next.js core-web-vitals and TypeScript rules.
