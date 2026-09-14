import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

export const categoryOptionSchema = z.object({
  id: z.number({ message: TEXTS.validation.invalidIdFormat }),
  name: z.string().min(1, TEXTS.validation.categoryNameRequired),
});

export type CategoryOption = z.infer<typeof categoryOptionSchema>;
