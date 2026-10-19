---
name: pnpm lockfile sync
description: Keep pnpm's lockfile and workspace installation aligned after targeted dependency updates.
---

After a targeted dependency update or lockfile-only change, run a normal frozen pnpm install before relying on `pnpm why` to verify the resolved tree. A lockfile-only validation can pass while local `node_modules` still reflects the previous peer-dependency context.

**Why:** In this workspace, `pnpm why` failed after the lockfile was narrowed but before the frozen install synchronized the local installation; it succeeded afterward.

**How to apply:** Use `pnpm install --frozen-lockfile` after dependency-lock changes, then verify the affected package with `pnpm why -r <package>`.
