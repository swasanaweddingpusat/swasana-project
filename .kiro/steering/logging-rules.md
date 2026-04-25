---
inclusion: always
---

# Logging Rules

## Console Output

- **No `console.log()` in runtime code** — this includes `app/`, `actions/`, `lib/`, `hooks/`, `components/`, `services/`, `emails/`.
- Use `console.error()` only for caught exceptions that need visibility (e.g., inside catch blocks in server actions).
- Seeder (`prisma/seed.ts`) and CLI scripts are exempt — progress logs are fine there.

## Pattern

```ts
// ✅ Good — error logging in catch block
catch (error) {
  console.error("[inviteUser] Error:", error);
  return { success: false, error: "Terjadi kesalahan." };
}

// ❌ Bad — debug logging in runtime code
console.log("user data:", user);
console.log("reached here");
```

## Audit Logging

For business-level logging (login, user actions, data changes), use `logAudit()` from `lib/audit.ts` — not console output. See `project-rules.md` section 3.8 for required fields.
