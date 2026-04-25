---
inclusion: always
---

# Agent Behavior Rules — swasana-project

## 1. Think Hard Before Acting

Before writing ANY code:

1. **Read first** — Open and read every file you're about to change. Read files that import from it or are imported by it.
2. **Impact analysis** — If you change component A, identify ALL components that depend on A (imports, props, shared state, shared types). List them. Verify your change won't break them.
3. **Plan the change** — State what you'll do and why before doing it. If the change touches >3 files, outline the plan first.
4. **Verify after** — After making changes, run the build (`npx next build`) or at minimum check for TypeScript errors. Don't declare "done" without verification.

## 2. No Hallucination Policy

- **Never assume an API exists** — check `node_modules/next/dist/docs/` for Next.js APIs, check Prisma docs for ORM methods, check the actual codebase for project utilities.
- **Never invent props, fields, or methods** — if you're unsure whether a component accepts a prop or a DB model has a field, read the source file or `prisma/schema.prisma` first.
- **Never guess file paths** — use search/glob to confirm a file exists before importing from it.
- **If you don't know, say so** — "I'm not sure if X supports Y, let me check" is always better than confidently writing wrong code.
- **Next.js 16 is NOT your training data** — always read `node_modules/next/dist/docs/01-app/` before using any Next.js API. `proxy.ts` not `middleware.ts`. `cookies()` and `headers()` are async.

## 3. Impact Analysis Protocol

When modifying any file, answer these before writing code:

- **Who imports this file?** — Search for imports of the file you're changing.
- **Does the interface change?** — If you change exported types, function signatures, or component props, every consumer must be updated.
- **Does the behavior change?** — If a function now returns a different shape or throws differently, trace all callers.
- **Side effects on shared state?** — Changes to providers, contexts, or global stores affect the entire subtree.

If the answer to any of these reveals a cascade, handle ALL affected files in the same change — never leave the codebase in a broken state.

## 4. Code Quality Gates

### Absolutely Forbidden
- ❌ `console.log()` in runtime code — use `console.error()` only in catch blocks
- ❌ `any` type — use `unknown` and narrow with type guards
- ❌ `middleware.ts` — it's `proxy.ts` in Next.js 16
- ❌ `cookies()` / `headers()` without `await`
- ❌ Editing `components/ui/*` — shadcn-generated, never hand-edit
- ❌ `findMany()` without pagination
- ❌ Skipping rate limiting on any endpoint
- ❌ Leaving unused imports or variables

### Always Required
- ✅ Read the file before editing it
- ✅ `"use server"` directive on server actions
- ✅ Zod validation on all inputs
- ✅ `requirePermission()` before mutations
- ✅ `db.$transaction()` for multi-table writes
- ✅ `logAudit()` for sensitive actions
- ✅ Explicit return types on exported functions
- ✅ `@/` alias for imports (relative only within same feature folder)

## 5. Steering Files — Read Order

Before starting any task, check these files in `.kiro/steering/`:

| File | What it covers |
|---|---|
| `project-rules.md` | Stack, folder structure, auth rules, code conventions |
| `typescript-strict.md` | Type safety rules, no-any policy, ESLint compliance |
| `logging-rules.md` | No console.log, audit logging patterns |
| `breadcrumb-architecture.md` | Breadcrumb implementation decisions |

Also read `AGENTS.md` at project root — it contains the same rules for Claude-based agents.

## 6. When You're Stuck

- **Build fails?** Read the actual error. Don't guess fixes — trace the error to its source.
- **Same approach failed twice?** Stop. Diagnose the root cause. Try a fundamentally different approach.
- **Unsure about Next.js 16 behavior?** Read `node_modules/next/dist/docs/`. Don't rely on training data.
- **Unsure about Prisma/Neon?** Check `prisma/schema.prisma` and `lib/db.ts` for the actual adapter being used.
