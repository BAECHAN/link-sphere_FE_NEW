import { describe, expect, it } from 'vitest';
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_PATTERN,
} from '@/entities/account/config/account.contract';
import { TEXTS } from '@/shared/config/texts';
import { specNumber, specPattern } from '@/test/openapi-spec';

// BE 값이 바뀌면 FE codegen PR에서 이 테스트가 실패해, 손으로 둔 상수와 안내 문구를 고칠 자리를 알린다
describe('닉네임 계약 상수 ≡ 스펙', () => {
  it.each([
    ['가입', 'signup'],
    ['계정 수정', 'updateAccount'],
  ] as const)('%s 요청과 같은 규칙이다', (_, operationId) => {
    expect(NICKNAME_MIN_LENGTH).toBe(specNumber(operationId, 'nickname', 'minLength'));
    expect(NICKNAME_MAX_LENGTH).toBe(specNumber(operationId, 'nickname', 'maxLength'));
    expect(NICKNAME_PATTERN.source).toBe(specPattern(operationId, 'nickname').source);
  });

  it('안내 문구의 숫자가 상수와 같다', () => {
    const range = `${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자`;

    expect(TEXTS.validation.nicknameLength).toContain(
      `${NICKNAME_MIN_LENGTH}자 이상 ${NICKNAME_MAX_LENGTH}자 이하`
    );
    expect(TEXTS.auth.signup.nicknameHint).toContain(range);
    expect(TEXTS.mypage.nicknameHint).toContain(range);
    expect(TEXTS.placeholders.nickname).toContain(range);
  });
});
