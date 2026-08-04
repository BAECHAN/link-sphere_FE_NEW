import { describe, expect, it } from 'vitest';
import { TEXTS } from '@/shared/config/texts';

// TEXTS 전체를 재귀 순회하며 (dotted key, resolved string) 쌍을 모은다.
// 함수형 값(folderCreated 등)은 대표값 '테스트'로 1회 호출해 resolve한다 - 인자 타입이
// string이든 number든 템플릿 리터럴 보간은 런타임에 에러 없이 문자열로 강제 변환된다.
function collectStrings(obj: unknown, prefix = ''): [string, string][] {
  if (typeof obj === 'string') {
    return [[prefix, obj]];
  }
  if (typeof obj === 'function') {
    return [[prefix, String((obj as (arg: unknown) => string)('테스트'))]];
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
      collectStrings(value, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [];
}

// 콘솔/개발자 로그 전용 - 사용자에게 노출되지 않아 톤 규칙(해요체) 대상이 아니다.
const LOG_ONLY_KEYS = new Set([
  'messages.error.apiRequestFailed',
  'messages.error.appInitFailed',
  'messages.error.tokenRefreshFailed',
]);

// 해요체는 "-어요/이에요/돼요/없어요" 등 유효한 어미가 여러 형태라 "이렇게 끝나야 한다"를
// 하나의 정규식으로 강제하기보다, 구 합쇼체·격식 청유형이 "더 이상 없어야 한다"를 검사한다.
// 이 방식은 ariaLabels 같은 명사 라벨 네임스페이스까지 안전하게 함께 스캔할 수 있다 -
// 애초에 이 패턴이 나타나지 않는 라벨엔 오탐이 없다.
// "-니다"로 끝나는 문자열은 습니다/입니다/합니다/옵니다(가져옵니다 등 받침 없는 어간 + ㅂ니다)를
// 전부 포괄한다 - 초기 버전은 "습니다"만 검사해 "가져옵니다" 같은 -ㅂ니다 계열을 놓친 적이 있다.
const FORBIDDEN_PATTERNS = [/니다[.:]?$/, /니까\?$/];

describe('TEXTS 메시지 톤 일관성 (해요체)', () => {
  it('합쇼체·격식 청유형(-습니다/-니까?/-입니다)이 남아있지 않다', () => {
    const violations: string[] = [];

    for (const [path, value] of collectStrings(TEXTS)) {
      if (LOG_ONLY_KEYS.has(path)) {
        continue;
      }

      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(value)) {
          violations.push(`${path}: "${value}"`);
          break;
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
