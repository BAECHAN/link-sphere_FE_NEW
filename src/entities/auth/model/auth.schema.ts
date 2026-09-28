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

// 로그인 비밀번호는 회원가입 강도 규칙을 재검증하지 않는다 - 이미 가입된 계정의 비밀번호가
// 그 사이 규칙이 바뀌어 더 이상 매칭 안 될 수 있고, 어차피 맞는지 틀린지는 서버가 판단한다.
const loginPasswordSchema = z.string().min(1, TEXTS.validation.passwordRequired);

// ==================== 1. Domain Model Schema ====================

export const loginSchema = z.object({
  email: emailValidationSchema,
  password: loginPasswordSchema,
});

export const createAccountSchema = z
  .object({
    nickname: nicknameValidationSchema,
    email: emailValidationSchema,
    password: passwordValidationSchema,
    confirmPassword: z.string().min(1, TEXTS.validation.passwordRequired),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: TEXTS.validation.passwordMismatch,
    path: ['confirmPassword'],
  });

// ==================== 2. DTO ====================

export type Login = z.infer<typeof loginSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;

// 기존 import 경로 호환 — auth.api.ts 등이 이 경로에서 응답 타입을 가져간다.
export type { LoginResponse } from '@/entities/auth/model/auth.dto';
