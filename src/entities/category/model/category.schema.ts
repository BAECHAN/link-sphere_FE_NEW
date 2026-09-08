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
