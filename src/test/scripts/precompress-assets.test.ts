import { describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 선별 규칙을 여기서 검증한다(선례: prune-assets.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { findMissingPairs, isPrecompressTarget } from '../../../scripts/lib/precompress-assets.js';

describe('isPrecompressTarget', () => {
  it.each(['assets/js/index-abc.js', 'assets/css/index-abc.css', 'assets/vendor-abc.js'])(
    'assets/ 아래 .js·.css는 대상이다: %s',
    (key) => {
      expect(isPrecompressTarget(key)).toBe(true);
    }
  );

  it.each([
    'assets/js/index-abc.js.br',
    'assets/img/logo-abc.svg',
    'fonts/pretendard-1.3.9/a.woff2',
    'firebase-messaging-sw.js',
    'index.html',
  ])('이미 눌린 사본, 다른 확장자, assets/ 밖은 대상이 아니다: %s', (key) => {
    expect(isPrecompressTarget(key)).toBe(false);
  });
});

describe('findMissingPairs', () => {
  it('대상마다 .br 짝이 있으면 빈 배열', () => {
    const keys = [
      'assets/js/a.js',
      'assets/js/a.js.br',
      'assets/css/a.css',
      'assets/css/a.css.br',
      'assets/img/logo.svg',
    ];

    expect(findMissingPairs(keys)).toEqual([]);
  });

  it('짝이 없는 대상만 돌려준다', () => {
    const keys = ['assets/js/a.js', 'assets/js/a.js.br', 'assets/js/b.js', 'assets/css/a.css'];

    expect(findMissingPairs(keys)).toEqual(['assets/js/b.js', 'assets/css/a.css']);
  });
});
