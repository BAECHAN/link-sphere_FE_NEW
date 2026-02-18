import { z } from 'zod';

// --- Bookmark ---
export const bookmarkSchema = z.object({
  userId: z.string(),
  postId: z.string(),
  createdAt: z.coerce.date(),
});

// --- Reaction ---
export const reactionTypeEnum = z.enum(['LIKE', 'LOVE', 'CLAP', 'IDEA', 'THINKING']);
export const targetTypeEnum = z.enum(['POST', 'COMMENT']);

export const reactionSchema = z.object({
  userId: z.string(),
  targetId: z.string(),
  targetType: targetTypeEnum,
  reactionType: reactionTypeEnum,
  createdAt: z.coerce.date(),
});

export const createReactionSchema = reactionSchema.pick({
  targetId: true,
  targetType: true,
  reactionType: true,
});

export type Bookmark = z.infer<typeof bookmarkSchema>;
export type Reaction = z.infer<typeof reactionSchema>;
export type CreateReaction = z.infer<typeof createReactionSchema>;
export type ReactionType = z.infer<typeof reactionTypeEnum>;
export type TargetType = z.infer<typeof targetTypeEnum>;
