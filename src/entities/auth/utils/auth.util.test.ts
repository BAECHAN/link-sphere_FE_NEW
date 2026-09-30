import { describe, expect, it } from 'vitest';
import { PasswordUtil } from '@/entities/auth/utils/auth.util';
import { passwordValidationSchema } from '@/entities/auth/model/auth.schema';

describe('PasswordUtil.checkRequirements', () => {
  it.each([
    ['', { minLength: false, letter: false, digit: false, special: false }],
    ['abcdefgh', { minLength: true, letter: true, digit: false, special: false }],
    ['1234567', { minLength: false, letter: false, digit: true, special: false }],
    ['ab1!', { minLength: false, letter: true, digit: true, special: true }],
    // 공백은 정책상 특수문자로 인정된다(스키마의 [^a-zA-Z0-9]와 동일)
    ['ab 1', { minLength: false, letter: true, digit: true, special: true }],
    ['a`', { minLength: false, letter: true, digit: false, special: true }],
    // 한글·이모지는 특수문자가 아니다 - 어차피 ASCII 규칙에서 막히는 입력이다
    ['ab1한', { minLength: false, letter: true, digit: true, special: false }],
    ['ab1😀', { minLength: false, letter: true, digit: true, special: false }],
  ])('%j', (value, expected) => {
    expect(PasswordUtil.checkRequirements(value)).toEqual(expected);
  });
});

describe('PasswordUtil.findViolation', () => {
  it.each([
    ['password1!', null],
    ['password1!한글', 'nonAscii'],
    ['password1!😀', 'nonAscii'],
    ['pass\tword1!', 'nonAscii'],
    [`${'a1!'.repeat(21)}a`, null], // 64자
    [`${'a1!'.repeat(21)}ab`, 'tooLong'], // 65자
    // 둘 다 해당하면 비ASCII를 먼저 알린다
    [`${'a1!'.repeat(22)}한`, 'nonAscii'],
  ])('%j → %s', (value, expected) => {
    expect(PasswordUtil.findViolation(value)).toBe(expected);
  });
});

/**
 * 체크리스트 판정(PasswordUtil)과 zod 스키마(passwordValidationSchema)는 따로 쓰였다 - 스키마는
 * 확정된 정책 코드라 그대로 두고(docs/plans/2026-09-30-password-live-feedback.md), 둘의 전체
 * 통과 여부가 같은지를 여기서 전수 비교한다(useWindowGridVirtualizer.test.ts의 복제 판정 대조와
 * 같은 형태). 한쪽 규칙만 바뀌면 이 테스트가 실패한다.
 */
describe('PasswordUtil.isValid ≡ passwordValidationSchema', () => {
  const CLASS_CHARS = { letter: 'aZ', digit: '09', special: '!~' } as const;
  const CLASS_SUBSETS: (keyof typeof CLASS_CHARS)[][] = [
    ['letter'],
    ['digit'],
    ['special'],
    ['letter', 'digit'],
    ['letter', 'special'],
    ['digit', 'special'],
    ['letter', 'digit', 'special'],
  ];
  const LENGTHS = [0, 1, 7, 8, 9, 63, 64, 65, 100];
  const EXTRAS = ['', ' ', '한', '😀', '\t', '\n', '`'];

  const build = (length: number, classes: (keyof typeof CLASS_CHARS)[]) => {
    const pool = classes.map((c) => CLASS_CHARS[c]).join('');
    return Array.from({ length }, (_, i) => pool[i % pool.length]).join('');
  };

  const cases = LENGTHS.flatMap((length) =>
    CLASS_SUBSETS.flatMap((classes) =>
      EXTRAS.map((extra) => {
        const base = build(length, classes);
        const middle = Math.floor(base.length / 2);
        return base.slice(0, middle) + extra + base.slice(middle);
      })
    )
  );

  it('만든 입력에 통과·실패가 둘 다 충분히 섞여 있다(비교가 한쪽으로 쏠리지 않았는지)', () => {
    const passed = cases.filter((value) => passwordValidationSchema.safeParse(value).success);
    expect(cases.length).toBe(LENGTHS.length * CLASS_SUBSETS.length * EXTRAS.length);
    expect(passed.length).toBeGreaterThan(10);
    expect(cases.length - passed.length).toBeGreaterThan(10);
  });

  it.each(cases)('%j', (value) => {
    expect(PasswordUtil.isValid(value)).toBe(passwordValidationSchema.safeParse(value).success);
  });
});

describe('PasswordUtil.resolveRequirementStates', () => {
  const idle = { isTouched: false, isSubmitted: false };

  it('입력 중엔 충족만 초록, 못 채운 건 회색이다(빨강 없음)', () => {
    expect(PasswordUtil.resolveRequirementStates('ab1', idle)).toEqual({
      minLength: 'pending',
      letter: 'met',
      digit: 'met',
      special: 'pending',
    });
  });

  it('칸을 벗어난 뒤엔 못 채운 조건만 빨강이 된다', () => {
    expect(PasswordUtil.resolveRequirementStates('ab1', { ...idle, isTouched: true })).toEqual({
      minLength: 'unmet',
      letter: 'met',
      digit: 'met',
      special: 'unmet',
    });
  });

  it('빈 칸을 지나가기만 했으면 아직 지적하지 않는다', () => {
    const states = PasswordUtil.resolveRequirementStates('', { ...idle, isTouched: true });
    expect(Object.values(states)).toEqual(['pending', 'pending', 'pending', 'pending']);
  });

  it('빈 채로 제출하면 네 조건 모두 빨강이다', () => {
    const states = PasswordUtil.resolveRequirementStates('', { ...idle, isSubmitted: true });
    expect(Object.values(states)).toEqual(['unmet', 'unmet', 'unmet', 'unmet']);
  });
});

// docs/AUTH.md "비밀번호 입력 피드백"의 확인 칸 판정 표와 1:1
describe('PasswordUtil.resolveConfirmStatus', () => {
  const PW = 'Abcdef1!';
  const base = { password: PW, isFocused: true, isLatched: false, isSubmitted: false };

  it.each([
    ['초기(확인 칸 비어 있음)', { ...base, confirm: '' }, 'none'],
    ['빈 채로 제출', { ...base, confirm: '', isSubmitted: true }, 'required'],
    ['입력 중, 아직 짧음', { ...base, confirm: 'Abc' }, 'none'],
    ['글자 수 도달 · 일치', { ...base, confirm: PW }, 'match'],
    ['글자 수 도달 · 불일치', { ...base, confirm: 'Abcdef1?' }, 'mismatch'],
    [
      '불일치를 보여준 뒤 지워서 짧아짐',
      { ...base, confirm: 'Abcdef1', isLatched: true },
      'mismatch',
    ],
    ['불일치를 보여준 뒤 고침', { ...base, confirm: PW, isLatched: true }, 'match'],
    ['짧은 채로 칸을 벗어남', { ...base, confirm: 'Abc', isFocused: false }, 'mismatch'],
    ['일치를 보여준 뒤 다시 편집해 짧아짐', { ...base, confirm: 'Abcdef1' }, 'none'],
    [
      '확인 칸 밖에서 비밀번호를 고침(L.L. Bean 사례)',
      { ...base, password: 'Abcdef1?', confirm: 'Abcdef1?', isFocused: false, isLatched: true },
      'match',
    ],
    ['제출 후 다시 입력', { ...base, confirm: 'A', isSubmitted: true }, 'mismatch'],
    ['비밀번호보다 확인 칸을 먼저 입력', { ...base, password: '', confirm: 'abc' }, 'none'],
    ['자동완성이 두 칸을 채움(포커스 없음)', { ...base, confirm: PW, isFocused: false }, 'match'],
  ] as const)('%s', (_, input, expected) => {
    expect(PasswordUtil.resolveConfirmStatus(input)).toBe(expected);
  });
});
