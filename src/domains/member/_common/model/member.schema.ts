import { z } from 'zod';

// ==================== 1. Domain Model Schema ====================

export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Member = z.infer<typeof memberSchema>;
