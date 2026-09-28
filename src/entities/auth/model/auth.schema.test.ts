import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  createAccountSchema,
  passwordValidationSchema,
} from '@/entities/auth/model/auth.schema';
import { TEXTS } from '@/shared/config/texts';

describe('passwordValidationSchema', () => {
  it('64자를 넘으면 실패한다(서버 정책과 동일)', () => {
    const result = passwordValidationSchema.safeParse(`${'a1!'.repeat(21)}a`); // 64자
    expect(result.success).toBe(true);

    const tooLong = passwordValidationSchema.safeParse(`${'a1!'.repeat(21)}ab`); // 65자
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(tooLong.error.issues[0]?.message).toBe(TEXTS.validation.passwordMaxLength);
    }
  });

  it('한글이 섞이면 실패한다', () => {
    const result = passwordValidationSchema.safeParse('password1!한글');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(TEXTS.validation.passwordAsciiOnly);
    }
  });

  it('이모지가 섞이면 실패한다', () => {
    const result = passwordValidationSchema.safeParse('password1!😀');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(TEXTS.validation.passwordAsciiOnly);
    }
  });

  it('기존 화이트리스트에 없던 특수문자(백틱)도 이제 통과한다(서버가 특정 문자를 더 이상 가리지 않음)', () => {
    const result = passwordValidationSchema.safeParse('password1`');
    expect(result.success).toBe(true);
  });
});

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
