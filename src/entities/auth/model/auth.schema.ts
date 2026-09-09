import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';
import {
  nicknameValidationSchema,
  emailValidationSchema,
} from '@/entities/account/model/account.schema';

/** 재사용 가능한 비밀번호 검증 스키마 */
export const passwordValidationSchema = z
  .string()
  .regex(
    /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':",./< >?]).{8,}$/,
    TEXTS.validation.passwordRegex
  )
  .max(20, TEXTS.validation.passwordMaxLength);

// ==================== 1. Domain Model Schema ====================

export const loginSchema = z.object({
  email: emailValidationSchema,
  password: passwordValidationSchema,
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
});

export const createAccountSchema = z.object({
  nickname: nicknameValidationSchema,
  email: emailValidationSchema,
  password: passwordValidationSchema,
});

// ==================== 2. DTO ====================

export type Login = z.infer<typeof loginSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
