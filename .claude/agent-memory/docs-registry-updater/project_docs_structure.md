---
name: docs-registry-structure
description: Documents the /docs directory file list and CLAUDE.md formatting conventions for this project
type: project
---

All /docs files must be listed under the `## Docs` section in CLAUDE.md using this exact format (no space between `-` and `/docs/`):

```
-/docs/filename.md
```

**Why:** This formatting is already established in the file and must be matched exactly to stay consistent.

**How to apply:** When adding new entries, append them after the last existing `-/docs/` entry, before the blank line that separates the section from `## Architecture`.

Current registered docs files (as of 2026-03-12):
- /docs/ui.md
- /docs/data-fetching.md
- /docs/data-mutations.md
- /docs/auth.md
- /docs/server-components.md
- /docs/routing.md
- /docs/security.md
- /docs/PROMPT_clerk_queue.md

Note: PROMPT_clerk_queue.md uses uppercase and underscore naming, unlike the other files which are lowercase kebab-case.
