import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 판정 규칙을 여기서 검증한다(선례: prune-assets.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { findPrBodyProblems } from '../../../scripts/lib/pr-body.js';

const TEMPLATE = readFileSync(
  path.resolve(__dirname, '../../../.github/pull_request_template.md'),
  'utf8'
);

const FILLED = `## 요약

- 최근 검색어를 다시 고르면 입력창을 채운다

## 영향 범위

- NavbarSearch 하나

## 의도 대비 결과

원래 요청: 같은 검색어를 다시 고르면 무반응

| 의도 | 한 일 | 결과·증거 | 판정 |
| ---- | ----- | --------- | ---- |
| 입력창을 채운다 | submitQuery에서 setSearchInput | 테스트 4개 통과 | 됐음 |

## 검증

- [x] pnpm test
`;

describe('findPrBodyProblems', () => {
  it('필수 절이 모두 채워져 있으면 통과한다', () => {
    expect(findPrBodyProblems(FILLED, TEMPLATE)).toEqual([]);
  });

  it('템플릿을 그대로 둔 본문은 네 절 모두 비어 있다고 본다', () => {
    const problems = findPrBodyProblems(TEMPLATE, TEMPLATE);

    expect(problems).toHaveLength(4);
    expect(problems.every((problem) => problem.includes('템플릿 안내문 그대로'))).toBe(true);
  });

  it('빈 본문(null)은 네 절 모두 없다고 본다', () => {
    const problems = findPrBodyProblems(null, TEMPLATE);

    expect(problems).toHaveLength(4);
    expect(problems.every((problem) => problem.includes('절이 없습니다'))).toBe(true);
  });

  it('plan mode 작업의 "계획 대비 구현"도 의도 대비 결과 절로 인정한다', () => {
    const body = FILLED.replace('## 의도 대비 결과', '## 계획 대비 구현');

    expect(findPrBodyProblems(body, TEMPLATE)).toEqual([]);
  });

  it('이름 뒤에 덧붙인 제목("## 검증 (로컬)")도 그 절로 본다', () => {
    const body = FILLED.replace('## 검증', '## 검증 (로컬)');

    expect(findPrBodyProblems(body, TEMPLATE)).toEqual([]);
  });

  it('표 머리글만 있고 행이 비어 있으면 의도 대비 결과가 비었다고 본다', () => {
    const body = FILLED.replace(
      '| 입력창을 채운다 | submitQuery에서 setSearchInput | 테스트 4개 통과 | 됐음 |',
      '|      |       |           |      |'
    ).replace('원래 요청: 같은 검색어를 다시 고르면 무반응', '원래 요청:');

    expect(findPrBodyProblems(body, TEMPLATE)).toEqual([
      expect.stringContaining('"## 의도 대비 결과" 또는 "## 계획 대비 구현" 절이 비어 있거나'),
    ]);
  });

  it('HTML 주석만 있는 절은 비었다고 본다', () => {
    const body = FILLED.replace('- NavbarSearch 하나', '<!-- 나중에 채움 -->');

    expect(findPrBodyProblems(body, TEMPLATE)).toEqual([
      expect.stringContaining('"## 영향 범위" 절이 비어 있거나'),
    ]);
  });

  it('코드 블록 안의 "# " 줄은 절의 끝으로 보지 않는다', () => {
    const body = FILLED.replace('- [x] pnpm test', '```bash\n# 단위 테스트\npnpm test\n```');

    expect(findPrBodyProblems(body, TEMPLATE)).toEqual([]);
  });

  it('비슷한 이름("## 요약하면")은 그 절로 보지 않는다', () => {
    const body = FILLED.replace('## 요약', '## 요약하면');

    expect(findPrBodyProblems(body, TEMPLATE)).toEqual([
      expect.stringContaining('"## 요약" 절이 없습니다'),
    ]);
  });
});
