---
inclusion: always
---

# TypeScript Strict Rules — swasana-project

## No `any` Policy

- **NEVER** use `any` type anywhere in the codebase. This includes:
  - `as any` type assertions
  - `: any` type annotations
  - Implicit `any` from missing type annotations
  - `Record<string, any>` — use `Record<string, unknown>` instead
  - Function parameters without types
  - Callback parameters without types (e.g., `.map(x => ...)` must be `.map((x: Type) => ...)` if not inferred)

- **Use `unknown` instead of `any`** when the type is truly unknown, then narrow with type guards.

- **Use proper types** from Prisma, NextAuth, or custom type definitions:
  - Prisma types: import from `@prisma/client` or infer from query results using `Awaited<ReturnType<typeof queryFn>>`
  - NextAuth types: extend via `types/next-auth.d.ts` module augmentation
  - Component props: always define explicit interface or type

## Type Inference Rules

- Let TypeScript infer when the type is obvious (e.g., `const x = 5` — no need for `: number`)
- Always annotate function return types for exported functions
- Always annotate function parameters
- For `.map()`, `.filter()`, `.forEach()` callbacks — if TypeScript can't infer the type from the array, add explicit parameter types
- For `.replace()` callbacks — always type the parameters: `.replace(/pattern/, (match: string) => ...)`

## Prisma Types

- Use `Awaited<ReturnType<typeof getUsers>>` pattern to derive types from query functions
- Export type aliases from query files: `export type UsersQueryResult = Awaited<ReturnType<typeof getUsers>>`
- Never manually define types that duplicate Prisma schema — always derive from Prisma

## React Component Types

- Props: always define as `interface` (e.g., `interface ButtonProps { ... }`)
- Event handlers: use React's built-in types (e.g., `React.MouseEvent<HTMLButtonElement>`)
- Refs: always type the element (e.g., `useRef<HTMLDivElement>(null)`)
- State: let TypeScript infer from initial value, or annotate if initial value is `null` (e.g., `useState<User | null>(null)`)

## Server Actions

- Always type FormData extraction with proper casting and validation via Zod
- Return types should be explicit: `Promise<{ success: boolean; message?: string; error?: string }>`

## ESLint Compliance

- Fix all `@typescript-eslint/no-unused-vars` warnings
- Fix all `@typescript-eslint/no-unused-expressions` warnings
- Fix all `react-hooks/set-state-in-effect` errors — don't call setState in useEffect, use event handlers or derived state instead
- Fix all `react-hooks/refs` errors — don't access refs during render
- Use `shrink-0` instead of `flex-shrink-0` (Tailwind v4 canonical class)

## Import Hygiene

- Remove unused imports immediately
- Prefer named imports over default imports
- Group imports: React → Next.js → third-party → local (components, hooks, lib, types)

## Next.js Best Practices

### Server Component Redirects
- **NEVER** use `redirect()` in `page.tsx` for default sub-route navigation. This causes race conditions with App Router navigation — the redirect fires during layout re-renders and overrides user navigation to sibling routes.
- For default sub-route redirects (e.g., `/settings` → `/settings/user-management`), use `proxy.ts` (middleware) instead. Proxy runs before Server Component rendering and doesn't interfere with client-side navigation.
- Only use `redirect()` in Server Components for auth guards or conditional logic that depends on server-side data (e.g., redirect if not logged in).

### Database Calls in Auth Callbacks
- Always wrap DB calls in `try/catch` inside NextAuth callbacks (jwt, session). A failed DB call must NEVER crash the session — use stale token data as fallback.
- Use cache TTL pattern for JWT callback DB refreshes to minimize concurrent connections.

### Neon HTTP Adapter
- Neon free tier has low connection limits. Minimize concurrent DB calls.
- Never use `db.$transaction()` — Neon HTTP adapter doesn't support it. Use sequential operations instead.
- Always handle `AbortError` gracefully — it means Neon connection was overloaded.

### TanStack Query
- Always set `refetchOnWindowFocus: false` and `refetchOnMount: false` for queries that use `initialData` from Server Components.
- Use stable `queryKey` arrays — never include objects that create new references on every render.
- Client-side filtering/sorting is preferred over server-side for small datasets (<1000 rows) to reduce DB calls.

### SessionProvider
- Always configure `refetchInterval` (5+ minutes) and `refetchOnWindowFocus: false` to prevent excessive `/api/auth/session` calls.
