Perform a structured bug analysis and fix for the issue below.

## Bug description

$ARGUMENTS

## Project context

Link-Sphere FE — React 18 + TypeScript, TanStack Query 5, React Hook Form 7 + Zod 3, Zustand 5, TailwindCSS + Shadcn/ui.

Architecture: FSD (Feature-Sliced Design) with strict layer separation:

- `<entity>.api.ts` — pure API calls only
- `<entity>.keys.ts` — query keys + invalidation + success handlers
- `<entity>.queries.ts` — React Query mutation/query hooks
- `features/<feature>/hooks/use<FeatureName>.ts` — all business logic
- `features/<feature>/ui/<FeatureName>.tsx` — thin UI, calls hook only

## Step 1: Locate the issue

Search for relevant code in this order:

1. Feature hook: `features/<domain>/<slice>/hooks/`
2. Query/mutation hooks: `entities/<entity>/api/<entity>.queries.ts`
3. Keys + invalidation: `entities/<entity>/api/<entity>.keys.ts`
4. API layer: `entities/<entity>/api/<entity>.api.ts`
5. Schema: `entities/<entity>/model/<entity>.schema.ts`
6. UI component: `features/<domain>/<slice>/ui/`
7. Shared config: `src/shared/config/`
8. Shared utilities: `src/shared/`

## Step 2: Diagnose by layer

Identify which layer the bug is in:

| Layer            | Common issues                                                                    |
| ---------------- | -------------------------------------------------------------------------------- |
| **Schema**       | Zod type mismatch, wrong field name, missing `.nullable()`, wrong `z.coerce`     |
| **API**          | Wrong endpoint, wrong HTTP method, missing URL param, missing request body field |
| **Keys**         | Wrong query key causes stale data, missing invalidation after mutation           |
| **Queries**      | Wrong `onSuccess` handler, missing `enabled` condition, wrong select transform   |
| **Feature hook** | Wrong form default values, incorrect submit flow, missing error handling         |
| **UI**           | Wrong prop passed to component, missing `FormProvider`, wrong form field name    |
| **Config**       | Missing TEXTS key, wrong API_ENDPOINTS path                                      |

## Step 3: Apply the fix

Rules for applying fixes:

- **Minimal change**: fix only what is broken, do not refactor surrounding code
- **Respect layers**: do NOT move API calls into hooks, do NOT put logic in UI components
- **Never**: use native `confirm()` — always `useAlert` + `openConfirm`
- **Never**: add inline string literals — always use `TEXTS.*`
- **Never**: add inline query keys — always use `<entity>Keys.*`
- **Never**: add `any` types to satisfy TypeScript

## Step 4: Verify the fix

Check:

- [ ] TypeScript types are still consistent (no `any` introduced)
- [ ] Invalidated queries use key constants from `<entity>.keys.ts`
- [ ] UI strings come from `TEXTS.*`
- [ ] Layer separation is preserved

## If the bug cannot be determined

Before making changes, ask the user:

1. What is the expected behavior?
2. What is the actual behavior?
3. Which page/component triggers the issue?
4. Is there a console error or network request error?
