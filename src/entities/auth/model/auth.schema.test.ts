import { describe, expect, it } from 'vitest';
import { loginSchema, createAccountSchema } from '@/entities/auth/model/auth.schema';
import { TEXTS } from '@/shared/config/texts';

describe('loginSchema', () => {
  it('비밀번호가 회원가입 강도 규칙(영문+숫자+특수문자)을 만족하지 않아도 통과한다', () => {
    // 가입 당시엔 규칙을 만족했지만 이후 정책이 바뀌었을 수 있는 기존 계정을 흉내낸다 -
    // 로그인 폼은 서버가 맞는지 틀린지 판단하게 두고 클라이언트에서 강도를 재검증하지 않는다.
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'ab' });
    expect(result.success).toBe(true);
  });

  it('비밀번호가 비어있으면 실패한다', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(TEXTS.validation.passwordRequired);
    }
  });
});

describe('createAccountSchema', () => {
  const base = {
    nickname: '남극곰',
    email: 'user@example.com',
    password: 'password1!',
  };

  it('비밀번호와 확인 칸이 같으면 통과한다', () => {
    const result = createAccountSchema.safeParse({ ...base, confirmPassword: 'password1!' });
    expect(result.success).toBe(true);
  });

  it('비밀번호와 확인 칸이 다르면 confirmPassword 필드에 에러를 붙인다', () => {
    const result = createAccountSchema.safeParse({ ...base, confirmPassword: 'password2!' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
      expect(result.error.issues[0]?.message).toBe(TEXTS.validation.passwordMismatch);
    }
  });
});
