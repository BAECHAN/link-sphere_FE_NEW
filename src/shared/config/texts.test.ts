import { describe, expect, it } from 'vitest';
import { TEXTS } from '@/shared/config/texts';

// messages.success는 합쇼체 "-되었습니다."로 통일하기로 한 규칙(.claude/CLAUDE.md
// "TEXTS 구조 > 톤 규칙")을 자동으로 강제한다. 새 키를 다른 톤(-됨/-됐어요 등)으로
// 추가하면 이 테스트가 실패해 리뷰 없이도 바로 알아챌 수 있다.
describe('TEXTS.messages.success 톤 일관성', () => {
  it('모든 성공 메시지는 "-되었습니다."로 끝난다', () => {
    const ENDING = /되었습니다\.$/;
    const violations: string[] = [];

    for (const [key, value] of Object.entries(TEXTS.messages.success)) {
      const resolved = typeof value === 'function' ? value('테스트') : value;

      if (!ENDING.test(resolved)) {
        violations.push(`${key}: "${resolved}"`);
      }
    }

    expect(violations).toEqual([]);
  });
});
