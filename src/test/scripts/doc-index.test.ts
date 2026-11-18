import { describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 판정 규칙을 여기서 검증한다(선례: pr-body.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import {
  findUnclassified,
  parseDecisions,
  parsePlan,
  renderDecisionIndex,
  renderPlanIndex,
} from '../../../scripts/lib/doc-index.js';

const DECISIONS = `# 설계·UX 의사결정 기록

머리말

---

## 2026-09-21 — 중복 클릭 방지: 8ms → 500ms로 재조정

**배경**

요구가 바뀌었다.

**상태**

적용됨(이 항목의 PR). 계획은 따로 있다.

---

## 2026-09-21 — 사이드바 스크롤 영역 경계

**상태**: FE 적용(#459), BE 적용

---

## 2026-10-16 — (정정) 전환은 \`startTransition\`으로 해결돼 있지 않았음

**배경**

상태 문단이 없는 항목이다.

## 2026-09-21 — 사이드바 스크롤 영역 경계
`;

describe('parseDecisions', () => {
  const entries = parseDecisions(DECISIONS);

  it('날짜가 같은 항목을 각각 따로 읽는다', () => {
    expect(entries.map((entry) => entry.date)).toEqual([
      '2026-09-21',
      '2026-09-21',
      '2026-10-16',
      '2026-09-21',
    ]);
    expect(entries[1]?.title).toBe('사이드바 스크롤 영역 경계');
  });

  it('앵커는 기호를 지우고 공백을 하이픈으로 바꾼 값이다', () => {
    expect(entries[0]?.anchor).toBe('2026-09-21--중복-클릭-방지-8ms--500ms로-재조정');
    expect(entries[2]?.anchor).toBe(
      '2026-10-16--정정-전환은-starttransition으로-해결돼-있지-않았음'
    );
  });

  it('헤딩이 완전히 같으면 둘째부터 번호를 붙인다', () => {
    expect(entries[1]?.anchor).toBe('2026-09-21--사이드바-스크롤-영역-경계');
    expect(entries[3]?.anchor).toBe('2026-09-21--사이드바-스크롤-영역-경계-1');
  });

  it('상태는 문단 첫 구절만 읽고, 없으면 비운다', () => {
    expect(entries.map((entry) => entry.status)).toEqual(['적용됨', 'FE 적용', '', '']);
  });
});

describe('findUnclassified', () => {
  const entries = parseDecisions(DECISIONS);

  it('분류표에 없는 항목의 키를 돌려준다', () => {
    const topics = { '2026-09-21 — 사이드바 스크롤 영역 경계': '북마크' };

    expect(findUnclassified(entries, topics)).toEqual([
      '2026-09-21 — 중복 클릭 방지: 8ms → 500ms로 재조정',
      '2026-10-16 — (정정) 전환은 `startTransition`으로 해결돼 있지 않았음',
    ]);
  });
});

describe('renderDecisionIndex', () => {
  it('항목마다 주제별 표와 날짜순 표에 한 줄씩 싣는다', () => {
    const entries = parseDecisions(DECISIONS).slice(0, 3);
    const topics = {
      '2026-09-21 — 중복 클릭 방지: 8ms → 500ms로 재조정': '버튼·폼 규칙',
      '2026-09-21 — 사이드바 스크롤 영역 경계': '북마크',
      '2026-10-16 — (정정) 전환은 `startTransition`으로 해결돼 있지 않았음': '버튼·폼 규칙',
    };
    const index = renderDecisionIndex(entries, topics);

    expect(index).toContain('### 버튼·폼 규칙 (2)');
    expect(index).toContain('### 북마크 (1)');

    // 원본에서는 2026-10-16 항목이 2026-09-21 항목들 뒤에 있지만 날짜순 표에서는 맨 위다
    const byDate = index.slice(index.indexOf('## 날짜순'));

    expect(byDate.indexOf('| 2026-10-16 |')).toBeLessThan(byDate.indexOf('| 2026-09-21 |'));
    expect(index.match(/\.\/DECISIONS\.md#/g)).toHaveLength(6);
    expect(index).toContain(
      '| 2026-09-21 | [사이드바 스크롤 영역 경계](./DECISIONS.md#2026-09-21--사이드바-스크롤-영역-경계) | FE 적용 |'
    );
  });
});

const PLAN_WITH_RESULT = `# 카드 북마크 창 호스트

<!-- plan-result:start — 이 블록만 병합 뒤에도 고칠 수 있다 -->

## 구현 결과

> #500·#505 · 2026-11-03 대조 · 이탈 4 · 미구현 0 — 판정 근거는 각 PR 본문
> #511 · 2026-11-04 대조 · PR2(Phase 2) · 이탈 0 · 미구현 1 — 판정 근거는 PR 본문

- 이탈: 하나
- 대체됨(일부): \`docs/plans/2026-11-06-other.md\`(#557) — 이름을 바꿨다

<!-- plan-result:end -->

## Context

> #999 · 2026-11-05 대조 · 이탈 9 · 미구현 9 — 블록 밖이라 읽지 않는다
`;

describe('parsePlan', () => {
  it('결과 블록의 요약 줄에서 PR을 모으고 건수를 더한다', () => {
    expect(parsePlan('2026-11-03-bookmark-host.md', PLAN_WITH_RESULT)).toEqual({
      fileName: '2026-11-03-bookmark-host.md',
      date: '2026-11-03',
      title: '카드 북마크 창 호스트',
      result: { prs: ['#500', '#505', '#511'], deviations: 4, missing: 1 },
      superseded: '대체됨(일부)',
    });
  });

  it('결과 블록이 없으면 대조와 대체를 비운다', () => {
    const plan = parsePlan('2026-09-08-old-plan.md', '# 옛 계획\n\n## Context\n\n본문\n');

    expect(plan?.result).toBeNull();
    expect(plan?.superseded).toBe('');
  });

  it('이름이 날짜로 시작하지 않는 파일은 계획으로 보지 않는다', () => {
    expect(parsePlan('README.md', '# 안내\n')).toBeNull();
  });
});

describe('renderPlanIndex', () => {
  it('최신 달부터 월별로 묶고 계획마다 한 줄을 싣는다', () => {
    const plans = [
      parsePlan('2026-09-08-old-plan.md', '# 옛 계획\n'),
      parsePlan('2026-11-03-bookmark-host.md', PLAN_WITH_RESULT),
    ].filter((plan) => plan !== null);
    const index = renderPlanIndex(plans);

    expect(index.indexOf('## 2026-11 (1)')).toBeLessThan(index.indexOf('## 2026-09 (1)'));
    expect(index).toContain(
      '| 2026-11-03 | [카드 북마크 창 호스트](./plans/2026-11-03-bookmark-host.md) | #500 #505 #511 · 이탈 4 · 미구현 1 | 대체됨(일부) |'
    );
    expect(index).toContain('| 2026-09-08 | [옛 계획](./plans/2026-09-08-old-plan.md) |  |  |');
  });
});
