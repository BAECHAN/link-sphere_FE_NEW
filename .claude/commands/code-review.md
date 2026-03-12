Review the code changes for Link-Sphere FE architecture compliance.

## What to review

$ARGUMENTS

If no argument is provided, run `git diff HEAD` to get all uncommitted changes, then review those.

## Project context

Architecture: FSD (Feature-Sliced Design) with strict layer separation.
Reference files for correct patterns:

- `src/entities/post/api/post.keys.ts` — keys pattern
- `src/features/post/create/hooks/useCreatePost.ts` — feature hook pattern
- `src/entities/interaction/api/interaction.queries.ts` — optimistic update pattern

## Review checklist

### Architecture (Layer Separation)

- [ ] API calls only in `<entity>.api.ts` — not in hooks, not in components
- [ ] React Query hooks only in `<entity>.queries.ts` — not in feature hooks, not in UI
- [ ] Business logic (form, navigation, confirm dialogs) only in feature hooks
- [ ] UI components are thin — call one hook, render JSX, nothing else
- [ ] Zod schemas and types only in `entities/<entity>/model/<entity>.schema.ts`
- [ ] Query key constants come from `<entity>.keys.ts` — no inline `['entity', 'list']` strings

### Naming Conventions

- [ ] Feature directories use kebab-case domain-grouping: `features/<domain>/<slice>/` (e.g. `post/create/`, `comment/like/`)
- [ ] Mutation hooks named `use<Action><Entity>Mutation`
- [ ] Query hooks named `useFetch<Entity>Query` or `useSuspenseFetch<Entity>Query`
- [ ] Success handlers follow `handle<Entity><Action>Success`
- [ ] API object follows `<entity>Api`
- [ ] Query keys object follows `<entity>Keys`

### Pattern Compliance

- [ ] Delete actions use `useAlert` + `openConfirm` — NOT native `confirm()`
- [ ] Form submissions use `form.handleSubmit()` with `zodResolver`
- [ ] Forms use `FormProvider` + shared atoms (`FormInput`, `FormCheckbox`, etc.)
- [ ] Submit button disabled state: `!isDirty || !isValid || isPending`
- [ ] Toast messages via `meta.successMessage` / `meta.errorMessage` in `TEXTS.*`
- [ ] Optimistic updates (if any): cancel queries → update cache → restore on error

### TypeScript Quality

- [ ] No `any` types
- [ ] No manual TypeScript interfaces when `z.infer<typeof schema>` exists
- [ ] Nullable API fields use `.nullable()` in Zod — not `T | undefined`
- [ ] Date fields use `z.coerce.date()` — not `z.string()`

### Hardcoded Values (should all use constants)

- [ ] No hardcoded UI strings — use `TEXTS.*`
- [ ] No hardcoded route strings — use `ROUTES_PATHS.*`
- [ ] No hardcoded API paths — use `API_ENDPOINTS.*`
- [ ] `console.error` in catch blocks is acceptable; `console.log` for debugging is not

### Common Mistakes

- [ ] No business logic in page components (`src/pages/`)
- [ ] No direct `queryClient.invalidateQueries` calls in feature hooks — use success handlers from `.keys.ts`
- [ ] No empty `onSuccess` in mutations without a comment explaining why

## Output format

For each issue found:

1. File path and line number
2. Which checklist item it violates
3. The corrected code snippet

End with: **X issues found across Y checklist items reviewed.**

If no issues found, confirm: **All changes comply with the architecture patterns.**
