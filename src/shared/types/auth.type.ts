import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

const roleEnum = z.enum(['USER', 'ADMIN']);

export const nicknameValidationSchema = z
  .string()
  .regex(/^[a-zA-Z0-9가-힣_.-]{2,20}$/, TEXTS.validation.nicknameRegex);

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

export const loginSchema = z.object({
  email: emailValidationSchema,
  password: passwordValidationSchema,
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
});

export const accountSchema = z.object({
  id: z.string(),
  nickname: nicknameValidationSchema,
  email: emailValidationSchema,
  image: z.string().optional(),
  role: roleEnum,
  created_at: z.string(),
  updated_at: z.string(),
});

export const createAccountSchema = z.object({
  nickname: nicknameValidationSchema,
  email: emailValidationSchema,
  password: passwordValidationSchema,
});

// 수정 요청 (Partial 사용)
// password는 memberSchema에 없으므로 extend로 추가
export const updateAccountSchema = accountSchema
  .pick({
    nickname: true,
  })
  .extend({
    password: passwordValidationSchema.or(z.literal('')),
  })
  .partial();

// ==================== 2. DTO ====================

export type Login = z.infer<typeof loginSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
