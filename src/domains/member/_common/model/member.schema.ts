import { z } from 'zod';

// ==================== 1. Domain Model Schema ====================

export const memberRoleSchema = z.enum(['ADMIN', 'USER']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const memberSchema = z.object({
  userIdx: z.number(),
  userId: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: memberRoleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Member = z.infer<typeof memberSchema>;
