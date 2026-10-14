import { describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 선별 규칙을 여기서 검증한다
// (src 밖 코드를 src 안에서 테스트하는 선례: src/app/routes/cloudfront-functions.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { RETENTION_DAYS, selectPrunableKeys } from '../../../scripts/lib/prune-assets.js';

const NOW = '2026-10-14T06:00:00Z';
const OLD = '2026-09-01T00:00:00Z'; // 보존 기간보다 오래됨
const RECENT = '2026-10-13T00:00:00Z'; // 보존 기간 안

describe('selectPrunableKeys', () => {
  it('지금 빌드에 없고 보존 기간이 지난 assets/만 고른다', () => {
    const objects = [
      { Key: 'assets/js/index-old.js', LastModified: OLD },
      { Key: 'assets/js/index-recent.js', LastModified: RECENT },
    ];

    expect(selectPrunableKeys(objects, new Set(), NOW)).toEqual(['assets/js/index-old.js']);
  });

  it('지금 빌드에 있는 파일은 업로드가 오래됐어도 남긴다 - 업로드를 건너뛴 파일에 대한 안전장치', () => {
    const objects = [{ Key: 'fonts/pretendard/a.woff2', LastModified: OLD }];
    const currentKeys = new Set(['fonts/pretendard/a.woff2']);

    expect(selectPrunableKeys(objects, currentKeys, NOW)).toEqual([]);
  });

  it('정리 대상 접두사(assets/·fonts/) 밖은 건드리지 않는다 - storybook/ 등', () => {
    const objects = [
      { Key: 'storybook/assets/a.js', LastModified: OLD },
      { Key: 'index.html', LastModified: OLD },
      { Key: 'fonts/old.woff2', LastModified: OLD },
    ];

    expect(selectPrunableKeys(objects, new Set(), NOW)).toEqual(['fonts/old.woff2']);
  });

  it(`보존 기간(${RETENTION_DAYS}일) 경계 - 정확히 그 시점은 남기고 그보다 이전만 지운다`, () => {
    const objects = [
      { Key: 'assets/at-cutoff.js', LastModified: '2026-10-07T06:00:00Z' },
      { Key: 'assets/before-cutoff.js', LastModified: '2026-10-07T05:59:59Z' },
    ];

    expect(selectPrunableKeys(objects, new Set(), NOW)).toEqual(['assets/before-cutoff.js']);
  });
});
