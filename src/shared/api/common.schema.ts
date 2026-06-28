import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

export const categoryOptionSchema = z.object({
  id: z.number({ message: TEXTS.validation.invalidIdFormat }),
  name: z.string().min(1, TEXTS.validation.categoryNameRequired),
  slug: z.string().min(1, TEXTS.validation.categorySlugRequired),
  sortOrder: z.number().int().nonnegative().default(0),
  createdAt: z.coerce.date(),
});

export type CategoryOption = z.infer<typeof categoryOptionSchema>;

export const paginationRequestSchema = z.object({
  page: z.number().int().nonnegative().default(0),
  size: z.number().int().positive().default(10),
});

export type PaginationRequest = z.infer<typeof paginationRequestSchema>;

export const paginationResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    page: z.number().int().nonnegative().default(0),
    size: z.number().int().positive().default(10),
    content: z.array(itemSchema),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    last: z.boolean(),
  });
