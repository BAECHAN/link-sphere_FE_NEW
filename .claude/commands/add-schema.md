Add a Zod schema file for a new entity in an existing domain.

## Argument format

"$ARGUMENTS" — format: `<domain-name> <entity-name>`

Examples: `post tag`, `member address`, `notification setting`

Parse:

- Domain: first word
- Entity: remaining words (kebab-case → PascalCase for type names)

## Before creating the file

Read `src/shared/config/texts.ts` to understand existing validation messages.
Check `src/entities/post/model/post.schema.ts` for style reference.

## File to create

`src/entities/<entity>/model/<entity>.schema.ts`

```typescript
import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';
// Import shared schemas if the entity uses pagination:
// import { paginationResponseSchema } from '@/shared/api/common.schema';
// Import other entity schemas if composing:
// import { accountSchema } from '@/entities/user/model/auth.schema';

// ==================== 1. Domain Model Schema ====================
/**
 * Backend <entity> entity — mirrors the server response shape
 */
export const <entity>Schema = z.object({
  id: z.string(),
  // TODO: add actual fields from the backend entity
  // Common field patterns:
  //   name: z.string().min(1, TEXTS.validation.nameRequired),
  //   description: z.string().nullable(),
  //   isActive: z.boolean().default(true),
  //   count: z.number().int().nonnegative().default(0),
  //   image: z.string().nullable(),
  //   author: accountSchema.pick({ id: true, nickname: true, image: true }),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ==================== 2. List Response Schema (uncomment if paginated) ====================
// export const <entity>ListResponseSchema = paginationResponseSchema(<entity>Schema);

// ==================== 3. Form / Mutation Schemas ====================
export const create<Entity>Schema = z.object({
  // TODO: only fields the user provides when creating
  // Usually a subset of the domain model fields
});

export const update<Entity>Schema = z.object({
  // TODO: only fields the user provides when updating
});

// ==================== 4. TypeScript Types ====================
export type <Entity> = z.infer<typeof <entity>Schema>;
// export type <Entity>ListResponse = z.infer<typeof <entity>ListResponseSchema>;
export type Create<Entity> = z.infer<typeof create<Entity>Schema>;
export type Update<Entity> = z.infer<typeof update<Entity>Schema>;
```

## Conventions to follow

- Use `z.coerce.date()` for all date fields from the API (not `z.string()`)
- Use `.nullable()` for fields that can be null in the API response
- Use `.optional()` only for truly optional user input fields in mutation schemas
- Use `.default(value)` for fields with server defaults (statistics counters, boolean flags)
- Reuse validation messages from `TEXTS.validation.*` — if a needed message is missing, add it to `texts.ts`
- Keep domain model schema (full server response) and form schemas (user input) strictly separate
- Export types using `z.infer<typeof ...>` — do NOT write separate TypeScript interfaces
- For recursive types (e.g. comments with replies), use `z.lazy()`
- Compose schemas with `.pick()`, `.omit()`, `.extend()`, `.merge()` instead of duplicating fields

## Next steps

After creating the schema, run:
`/add-entity-api <domain> <entity>` — to create the .api.ts, .keys.ts, and .queries.ts files
