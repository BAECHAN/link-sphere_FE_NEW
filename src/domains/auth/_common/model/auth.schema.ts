import { z } from 'zod';
import {
  Member,
  memberSchema,
  passwordValidationSchema,
} from '@/domains/member/_common/model/member.schema';

// ==================== 1. Domain Model Schema ====================

export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

const accountSchema = memberSchema;

export type Account = z.infer<typeof accountSchema>;

// ==================== 2. Request DTO ====================

export type LoginRequest = z.infer<typeof loginSchema>;

// 수정 요청 (Partial 사용)
// password는 memberSchema에 없으므로 extend로 추가
export const updateAccountSchema = accountSchema
  .pick({
    name: true,
  })
  .extend({
    password: passwordValidationSchema.or(z.literal('')),
  })
  .partial();

export type UpdateAccountRequest = z.infer<typeof updateAccountSchema>;

// ==================== 3. Response DTO ====================

export interface LoginData {
  accessToken: string;
  refreshToken: string;
  user: Member;
}

export type LoginResponse = LoginData;
