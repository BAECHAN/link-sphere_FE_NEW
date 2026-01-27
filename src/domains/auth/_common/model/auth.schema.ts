import { z } from 'zod';
import { MemberRole } from '@/domains/member/_common/model/member.schema';

// 1. Request
export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

export type LoginRequest = z.infer<typeof loginSchema>;

// 2. Response Data
export interface LoginData {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: MemberRole;
  };
}

export type LoginResponse = LoginData;
