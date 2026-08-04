import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

const roleEnum = z.enum(['USER', 'ADMIN']);

// 길이와 허용 문자를 하나의 정규식으로 합치면, 글자 수는 맞는데 허용되지 않는 문자가 섞였을 때도
// (예: 완성되지 않은 낱자모 "ㅎㅍㅊ...") 길이 안내 메시지가 떠서 실제 원인과 다른 메시지를 보게 된다.
// passwordValidationSchema와 동일하게 길이·문자 규칙을 분리해 각자 맞는 메시지가 뜨도록 한다.
export const nicknameValidationSchema = z
  .string()
  .min(2, TEXTS.validation.nicknameLength)
  .max(20, TEXTS.validation.nicknameLength)
  .regex(/^[a-zA-Z0-9가-힣_.-]*$/, TEXTS.validation.nicknameCharset);

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

// 수정 요청 — nickname 필수, image는 BE가 null로 반환할 수 있으므로 nullish
export const updateAccountSchema = z.object({
  nickname: nicknameValidationSchema,
  image: z.string().nullish(),
});

// ==================== 2. DTO ====================

export type Login = z.infer<typeof loginSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
