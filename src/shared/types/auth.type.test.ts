import { describe, expect, it } from 'vitest';
import { nicknameValidationSchema } from '@/shared/types/auth.type';
import { TEXTS } from '@/shared/config/texts';

describe('nicknameValidationSchema', () => {
  it('길이·문자 조건을 모두 만족하면 통과한다', () => {
    expect(nicknameValidationSchema.safeParse('남극곰').success).toBe(true);
  });

  it('글자 수가 짧으면 길이 안내 메시지를 띄운다', () => {
    const result = nicknameValidationSchema.safeParse('a');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(TEXTS.validation.nicknameLength);
    }
  });

  it('글자 수는 맞지만 완성되지 않은 낱자모가 섞이면 길이가 아니라 문자 안내 메시지를 띄운다', () => {
    // 실제 리포트 사례: "남극곰" + 낱자모(ㅎㅍㅊㅌㅊㅍㅋㅌㅊㅍ) = 13자, 길이(2~20)는 통과하지만
    // 완성형 한글(가-힣)에 속하지 않는 문자라 문자 규칙에는 걸린다.
    const result = nicknameValidationSchema.safeParse('남극곰ㅎㅍㅊㅌㅊㅍㅋㅌㅊㅍ');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(TEXTS.validation.nicknameCharset);
    }
  });
});
