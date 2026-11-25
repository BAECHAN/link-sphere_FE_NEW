import { describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 선별 규칙을 여기서 검증한다(선례: precompress-assets.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { isLhrFile } from '../../../scripts/lib/lighthouse-report.js';

describe('isLhrFile', () => {
  // 앞의 둘은 PR #687 CI 산출물(lighthouse-report)의 실제 파일 이름이다. @lhci/cli 0.16.0은 이 꼴로 쓴다
  it.each([
    'lhr-1795585347398-931827.json',
    'lhr-1795585381292-27374.json',
    'lhr-1795585347398.json',
  ])('실행 결과 JSON은 고른다: %s', (fileName) => {
    expect(isLhrFile(fileName)).toBe(true);
  });

  it.each(['lhr-1795585347398-931827.html', 'assertion-results.json', 'links.json'])(
    '같은 실행의 HTML 리포트와 기준 검사·링크 파일은 고르지 않는다: %s',
    (fileName) => {
      expect(isLhrFile(fileName)).toBe(false);
    }
  );
});
