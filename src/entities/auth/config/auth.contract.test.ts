import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/entities/auth/config/auth.contract';
import { passwordValidationSchema } from '@/entities/auth/model/auth.schema';
import {
  changePasswordBodyNewPasswordMax,
  changePasswordBodyNewPasswordMin,
  changePasswordBodyNewPasswordRegExp,
  confirmPasswordResetBodyNewPasswordMax,
  confirmPasswordResetBodyNewPasswordMin,
  confirmPasswordResetBodyNewPasswordRegExp,
  signupBodyPasswordMax,
  signupBodyPasswordMin,
  signupBodyPasswordRegExp,
} from '@/shared/api/generated/openapi.zod';
import { TEXTS } from '@/shared/config/texts';

// BE 값이 바뀌면 FE codegen PR에서 이 테스트가 실패해, 손으로 둔 상수·스키마·안내 문구를 고칠 자리를 알린다
describe('비밀번호 계약 상수 ≡ 스펙', () => {
  it.each([
    ['가입', signupBodyPasswordMin, signupBodyPasswordMax, signupBodyPasswordRegExp],
    [
      '비밀번호 변경',
      changePasswordBodyNewPasswordMin,
      changePasswordBodyNewPasswordMax,
      changePasswordBodyNewPasswordRegExp,
    ],
    [
      '비밀번호 재설정',
      confirmPasswordResetBodyNewPasswordMin,
      confirmPasswordResetBodyNewPasswordMax,
      confirmPasswordResetBodyNewPasswordRegExp,
    ],
  ])('%s 요청과 같은 규칙이다', (_, min, max, pattern) => {
    expect(PASSWORD_MIN_LENGTH).toBe(min);
    expect(PASSWORD_MAX_LENGTH).toBe(max);
    // 패턴은 FE 스키마가 둘로 나눠 갖고 있어 아래 차등 테스트가 가입 패턴으로 대조한다 - 여기선 세 요청이 같은지만 본다
    expect(pattern.source).toBe(signupBodyPasswordRegExp.source);
  });

  it('안내 문구의 숫자가 상수와 같다', () => {
    expect(TEXTS.validation.passwordRegex).toContain(`${PASSWORD_MIN_LENGTH}자 이상`);
    expect(TEXTS.validation.passwordMaxLength).toContain(`${PASSWORD_MAX_LENGTH}자 이하`);
    expect(TEXTS.auth.password.requirements.minLength).toContain(`${PASSWORD_MIN_LENGTH}자 이상`);
  });
});

// passwordValidationSchema는 안내 문구를 나누려고 정규식을 둘로 나누고 최소 길이를 정규식 안에 품는다. 그래서 스펙
// 규칙(길이 범위 + 패턴)과 같은 판정을 하는지 표본으로 대조한다. 길이는 BE @Size와 같이 String 길이로 센다 -
// 길이가 갈릴 수 있는 비ASCII 입력은 어차피 패턴에서 떨어진다.
describe('passwordValidationSchema ≡ 스펙 규칙', () => {
  const CLASS_CHARS = { letter: 'aZ', digit: '09', special: '!~' } as const;
  const CLASS_SUBSETS: (keyof typeof CLASS_CHARS)[][] = [
    ['letter', 'digit'],
    ['letter', 'special'],
    ['digit', 'special'],
    ['letter', 'digit', 'special'],
  ];
  const LENGTHS = [0, 7, 8, 9, 63, 64, 65];
  const EXTRAS = ['', ' ', '한', '😀', '\n'];

  const build = (length: number, classes: (keyof typeof CLASS_CHARS)[]) => {
    const pool = classes.map((c) => CLASS_CHARS[c]).join('');
    return Array.from({ length }, (_, i) => pool[i % pool.length]).join('');
  };

  const cases = LENGTHS.flatMap((length) =>
    CLASS_SUBSETS.flatMap((classes) => EXTRAS.map((extra) => build(length, classes) + extra))
  );

  const passesSpec = (value: string) =>
    value.length >= signupBodyPasswordMin &&
    value.length <= signupBodyPasswordMax &&
    signupBodyPasswordRegExp.test(value);

  it('표본에 통과·실패가 둘 다 충분히 섞여 있다(비교가 한쪽으로 쏠리지 않았는지)', () => {
    const passed = cases.filter(passesSpec);
    expect(passed.length).toBeGreaterThan(5);
    expect(cases.length - passed.length).toBeGreaterThan(5);
  });

  it.each(cases)('%j', (value) => {
    expect(passwordValidationSchema.safeParse(value).success).toBe(passesSpec(value));
  });
});
