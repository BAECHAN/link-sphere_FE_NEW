// 계획 대조 평가 사례 생성(plan-eval-cases.mjs)과 평가 workflow 채점의 회귀 테스트.
// 실행: node --test .claude/hooks/plan-eval-cases.test.mjs (docs/plans/2026-10-31-ai-loop-graph-readiness.md Phase 1)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import {
  createRng,
  donorHunks,
  injectDefects,
  joinDiff,
  removalCandidates,
  splitDiff,
} from '../scripts/plan-eval-cases.mjs';

const fileDiff = (filePath, { isNew = false, hunks = 1 } = {}) =>
  [
    `diff --git a/${filePath} b/${filePath}`,
    ...(isNew
      ? ['new file mode 100644', 'index 0000000..1111111']
      : ['index 1111111..2222222 100644']),
    `--- ${isNew ? '/dev/null' : `a/${filePath}`}`,
    `+++ b/${filePath}`,
    ...Array.from({ length: hunks }, (_, i) => [
      `@@ -${i * 10 + 1},2 +${i * 10 + 1},3 @@`,
      ' a',
      '+b',
      ' c',
    ]).flat(),
  ].join('\n');

const TARGET = splitDiff(
  [
    fileDiff('CHANGELOG.md'),
    fileDiff('docs/POST.md'),
    fileDiff('src/a/Planned.tsx', { hunks: 2 }),
    fileDiff('src/a/Known.tsx'),
    fileDiff('src/z/Unmentioned.ts'),
  ].join('\n')
);
const PLAN = '`src/a/Planned.tsx`와 `Known.tsx`를 고치고 CHANGELOG.md·docs/POST.md를 갱신한다.';
const DONORS = [
  {
    pr: 2,
    sections: splitDiff(
      [
        fileDiff('src/m/Donor.ts'),
        fileDiff('src/a/Planned.tsx'),
        fileDiff('src/n/Brand.ts', { isNew: true }),
        fileDiff('docs/OTHER.md'),
      ].join('\n')
    ),
  },
];

test('splitDiff·joinDiff는 diff를 그대로 되돌린다', () => {
  const text = `${fileDiff('src/a.ts', { hunks: 2 })}\n${fileDiff('src/b.ts', { isNew: true })}\n`;
  const sections = splitDiff(text);

  assert.deepEqual(
    sections.map((s) => [s.path, s.hunks.length]),
    [
      ['src/a.ts', 2],
      ['src/b.ts', 1],
    ]
  );
  assert.equal(joinDiff(sections), text);
});

test('같은 시드는 같은 수열을 낸다', () => {
  const a = createRng(7);
  const b = createRng(7);

  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(createRng(8)(), createRng(7)());
});

test('빼기 후보는 계획에 이름이 나온 파일 중 CHANGELOG·원래 대조가 짚은 파일을 뺀다', () => {
  assert.deepEqual(
    removalCandidates(TARGET, PLAN, ['src/a/Known.tsx']).map((s) => s.path),
    ['docs/POST.md', 'src/a/Planned.tsx']
  );
});

test('끼우기 후보는 대상 diff·계획에 없는 src/ 수정 파일의 hunk뿐이다', () => {
  assert.deepEqual(
    donorHunks(DONORS, TARGET, PLAN).map((h) => h.path),
    ['src/m/Donor.ts']
  );
});

test('결함 주입: 파일 하나를 통째로 빼고 다른 PR hunk를 경로 순서 자리에 끼운다', () => {
  const result = injectDefects({
    sections: TARGET,
    planText: PLAN,
    known: ['src/a/Known.tsx', 'docs/POST.md'],
    donors: DONORS,
    rng: createRng(1),
  });

  assert.equal(result.removed, 'src/a/Planned.tsx');
  assert.equal(result.inserted, 'src/m/Donor.ts');
  assert.equal(result.donorPr, 2);
  assert.deepEqual(
    result.sections.map((s) => s.path),
    ['CHANGELOG.md', 'docs/POST.md', 'src/a/Known.tsx', 'src/m/Donor.ts', 'src/z/Unmentioned.ts']
  );
  assert.match(
    joinDiff(result.sections),
    /diff --git a\/src\/m\/Donor\.ts b\/src\/m\/Donor\.ts\nindex/
  );
});

test('후보가 없으면 조용히 넘어가지 않고 멈춘다', () => {
  assert.throws(
    () =>
      injectDefects({
        sections: TARGET,
        planText: '',
        known: [],
        donors: DONORS,
        rng: createRng(1),
      }),
    /후보가 없다/
  );
});

// workflow 파일을 그대로 불러 가짜 agent·pipeline으로 돌린다. 채점 로직을 테스트용으로 따로 베끼지 않는다.
async function runWorkflow(args, outputs) {
  const source = fs
    .readFileSync(new URL('../workflows/plan-verifier-eval.js', import.meta.url), 'utf8')
    .replace(/^export const meta/m, 'const meta');
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const run = new AsyncFunction('agent', 'pipeline', 'phase', 'args', source);
  const prompts = [];
  const agent = async (prompt, opts) => {
    prompts.push({ prompt, opts });

    return outputs[opts.label.split(':')[1]];
  };
  const pipeline = (items, ...stages) =>
    Promise.all(
      items.map(async (item, index) => {
        let value = item;

        for (const stage of stages) {
          value = await stage(value, item, index);
        }

        return value;
      })
    );

  return { result: await run(agent, pipeline, () => {}, args), prompts };
}

test('workflow 채점: 검출·놓침·오탐을 정답 파일 경로로 가른다', async () => {
  const cases = [
    {
      id: 'case-1',
      pr: 1,
      role: 'defect',
      planPath: '/eval/case-1/plan.md',
      diffPath: '/eval/case-1/diff.patch',
      known: ['docs/POST.md'],
      removed: ['src/a/Planned.tsx'],
      inserted: ['src/m/Donor.ts'],
    },
    {
      id: 'case-2',
      pr: 2,
      role: 'normal',
      planPath: '/eval/case-2/plan.md',
      diffPath: '/eval/case-2/diff.patch',
      known: ['src/k/Known.ts'],
      removed: [],
      inserted: [],
    },
    {
      id: 'case-3',
      pr: 3,
      role: 'defect',
      planPath: '/p',
      diffPath: '/d',
      known: [],
      removed: ['src/r.ts'],
      inserted: ['src/i.ts'],
    },
  ];
  const outputs = {
    'case-1': {
      items: [
        { item: '1', verdict: 'missing', files: ['`Planned.tsx:12`'], note: '' },
        { item: '2', verdict: 'implemented', files: ['src/m/Donor.ts'], note: '' },
        { item: '3', verdict: 'deviation', files: ['docs/POST.md'], note: '' },
      ],
      unplanned: [],
    },
    'case-2': {
      items: [
        { item: '1', verdict: 'out-of-scope', files: ['src/x.ts'], note: '' },
        { item: '2', verdict: 'deviation', files: ['src/k/Known.ts'], note: '' },
      ],
      unplanned: [{ files: ['b/src/y.ts'], note: '계획 밖' }],
    },
    'case-3': null,
  };
  const { result, prompts } = await runWorkflow({ agentType: 'plan-verifier', cases }, outputs);

  assert.equal(prompts.length, 3);
  assert.equal(prompts[0].opts.agentType, 'plan-verifier');
  assert.ok(prompts[0].opts.schema);
  assert.match(prompts[0].prompt, /\/eval\/case-1\/plan\.md/);
  assert.match(prompts[0].prompt, /\/eval\/case-1\/diff\.patch/);
  assert.doesNotMatch(prompts[0].prompt, /Planned|Donor/);
  assert.deepEqual(result.cases[0].detected, ['src/a/Planned.tsx']);
  assert.deepEqual(result.cases[0].missed, ['src/m/Donor.ts']);
  assert.deepEqual(result.cases[1].falsePositives, [{ files: ['b/src/y.ts'], note: '계획 밖' }]);
  assert.equal(result.cases[2].failed, true);
  assert.deepEqual(
    {
      detected: result.detected,
      expected: result.expected,
      normalFalsePositives: result.normalFalsePositives,
      normalCases: result.normalCases,
      defectFalsePositives: result.defectFalsePositives,
      failedCases: result.failedCases,
    },
    {
      detected: 1,
      expected: 4,
      normalFalsePositives: 1,
      normalCases: 1,
      defectFalsePositives: 0,
      failedCases: ['case-3'],
    }
  );
});

test('workflow는 args가 JSON 문자열로 와도 객체로 받은 것과 같게 채점한다', async () => {
  const args = {
    agentType: 'general-purpose',
    cases: [
      {
        id: 'case-1',
        pr: 1,
        role: 'defect',
        planPath: '/p',
        diffPath: '/d',
        known: [],
        removed: ['src/r.ts'],
        inserted: ['src/i.ts'],
      },
    ],
  };
  const outputs = {
    'case-1': {
      items: [{ item: '1', verdict: 'missing', files: ['src/r.ts'], note: '' }],
      unplanned: [],
    },
  };
  const fromObject = await runWorkflow(args, outputs);
  const fromString = await runWorkflow(JSON.stringify(args), outputs);

  assert.equal(fromString.prompts[0].opts.agentType, 'general-purpose');
  assert.deepEqual(fromString.result, fromObject.result);
});
