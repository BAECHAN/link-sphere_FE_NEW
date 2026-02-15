import { TEXTS } from '@/shared/config/texts';
import { z } from 'zod';

/** 재사용 가능한 비밀번호 검증 스키마 */
export const passwordValidationSchema = z
  .string()
  .regex(
    /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':",./< >?]).{8,}$/,
    TEXTS.validation.passwordRegex
  )
  .max(20, TEXTS.validation.passwordMaxLength);

export const emailValidationSchema = z.string().email(TEXTS.validation.emailRegex);

// ==================== 1. Domain Model Schema ====================

export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  image: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Member = z.infer<typeof memberSchema>;
