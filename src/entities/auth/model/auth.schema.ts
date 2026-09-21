import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';
import { nicknameValidationSchema, emailValidationSchema } from '@/entities/account/@x/auth';

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

export const createAccountSchema = z.object({
  nickname: nicknameValidationSchema,
  email: emailValidationSchema,
  password: passwordValidationSchema,
});

// ==================== 2. DTO ====================

export type Login = z.infer<typeof loginSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;

// 기존 import 경로 호환 — auth.api.ts 등이 이 경로에서 응답 타입을 가져간다.
export type { LoginResponse } from '@/entities/auth/model/auth.dto';
