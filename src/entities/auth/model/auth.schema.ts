import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';
import { nicknameValidationSchema, emailValidationSchema } from '@/entities/account/@x/auth';

// 서버(SignupRequest.password, docs/plans/2026-09-28-auth-hardening.md Phase 5)와 동일한
// 규칙 - 조합 규칙은 유지하되 특수문자 화이트리스트를 없애고(영문·숫자가 아니면 전부 인정)
// 길이 상한을 64자로, 출력 가능 ASCII만 허용하도록 맞췄다.
export const passwordValidationSchema = z
  .string()
  .regex(/^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{8,}$/, TEXTS.validation.passwordRegex)
  .max(64, TEXTS.validation.passwordMaxLength)
  .regex(/^[\x20-\x7E]*$/, TEXTS.validation.passwordAsciiOnly);

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

export const passwordResetRequestSchema = z.object({
  email: emailValidationSchema,
});

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(1, TEXTS.validation.tokenRequired),
    newPassword: passwordValidationSchema,
    confirmPassword: z.string().min(1, TEXTS.validation.passwordRequired),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: TEXTS.validation.passwordMismatch,
    path: ['confirmPassword'],
  });

// ==================== 2. DTO ====================

export type Login = z.infer<typeof loginSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;

// 기존 import 경로 호환 — auth.api.ts 등이 이 경로에서 응답 타입을 가져간다.
export type { LoginResponse } from '@/entities/auth/model/auth.dto';
