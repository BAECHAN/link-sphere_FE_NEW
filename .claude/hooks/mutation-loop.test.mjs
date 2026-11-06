// 뮤테이션 루프 래퍼(mutation-loop.mjs)의 판정 함수 회귀 테스트.
// 실행: node --test .claude/hooks/mutation-loop.test.mjs (docs/plans/2026-11-06-mutation-loop.md)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  afterRemeasure,
  agentStop,
  budgetLeft,
  buildSettings,
  checkChangedPaths,
  checkTestContent,
  fillPrompt,
  formatMutants,
  isInClone,
  loopEnv,
  parseChangedPaths,
  renderReport,
  sumSpent,
  summarizeMutants,
  testFilesFor,
} from '../scripts/mutation-loop.mjs';

const mutant = (status, line = 1) => ({
  status,
  mutatorName: 'ConditionalExpression',
  replacement: 'true',
  location: { start: { line, column: 5 } },
});

// claude-base lib/test-patterns.mjs는 CI에 없어 같은 모양의 패턴을 여기서 만든다.
const PATTERNS = {
  ASSERTION_LINE: /\bexpect\s*[.(]/,
  SKIP_LINE: /\.(skip|only|todo)\s*\(/,
  countLines: (text, pattern) => text.split('\n').filter((line) => pattern.test(line)).length,
};

test('summarizeMutants는 죽음·살아남음·안 닿음을 나누고 점수는 닿은 것 기준이다', () => {
  const report = {
    files: {
      'a.ts': {
        mutants: [
          mutant('Killed'),
          mutant('Timeout'),
          mutant('Survived', 7),
          mutant('NoCoverage', 9),
          mutant('RuntimeError'),
        ],
      },
    },
  };
  const summary = summarizeMutants(report, 'a.ts');

  assert.equal(summary.killed, 2);
  assert.equal(summary.survived, 1);
  assert.equal(summary.noCoverage, 1);
  assert.equal(summary.other, 1);
  assert.equal(summary.score, 66.7);
  assert.deepEqual(
    summary.remaining.map((m) => m.line),
    [7, 9]
  );
});

test('summarizeMutants는 닿은 뮤턴트가 없으면 점수를 null로 두고, 보고서에 없는 파일이면 멈춘다', () => {
  assert.equal(
    summarizeMutants({ files: { 'a.ts': { mutants: [mutant('NoCoverage')] } } }, 'a.ts').score,
    null
  );
  assert.throws(() => summarizeMutants({ files: {} }, 'a.ts'));
});

test('formatMutants는 여러 줄 치환 코드를 한 줄로 줄인다', () => {
  const line = formatMutants([
    {
      status: 'Survived',
      line: 3,
      column: 1,
      mutator: 'BlockStatement',
      replacement: '{\n  return;\n}',
    },
  ]);

  assert.equal(line, '3:1 [Survived] BlockStatement → { return; }');
});

test('fillPrompt는 자리표시자를 채운다', () => {
  assert.equal(fillPrompt('{{target}} → {{testFile}}', { target: 'a', testFile: 'b' }), 'a → b');
});

test('testFilesFor는 대상 옆의 .test.ts와 .test.tsx만 낸다', () => {
  assert.deepEqual(testFilesFor('src/a/useB.ts'), ['src/a/useB.test.ts', 'src/a/useB.test.tsx']);
});

test('parseChangedPaths는 상태 표기·따옴표를 떼고 이름 변경은 양쪽을 낸다', () => {
  assert.deepEqual(
    parseChangedPaths('?? src/a.test.ts\n M src/b.ts\nR  c.ts -> d.ts\n?? "e f.ts"\n'),
    ['src/a.test.ts', 'src/b.ts', 'c.ts', 'd.ts', 'e f.ts']
  );
});

test('checkChangedPaths는 허용된 테스트 파일 하나만 통과시킨다', () => {
  const allowed = testFilesFor('src/a/useB.ts');

  assert.equal(checkChangedPaths(['src/a/useB.test.ts'], allowed).ok, true);
  assert.equal(checkChangedPaths(['src/a/useB.test.tsx'], allowed).ok, true);
  assert.equal(checkChangedPaths([], allowed).ok, false);
  assert.equal(checkChangedPaths(['src/a/useB.ts'], allowed).ok, false);
  assert.equal(checkChangedPaths(['src/a/useB.stories.tsx'], allowed).ok, false);
  assert.equal(checkChangedPaths(['e2e/b.spec.ts'], allowed).ok, false);
  assert.equal(checkChangedPaths(['src/a/useC.test.ts'], allowed).ok, false);
  assert.equal(checkChangedPaths(['src/a/useB.test.ts', 'src/a/useB.test.tsx'], allowed).ok, false);
  assert.equal(checkChangedPaths(['src/a/useB.test.ts', 'src/a/useB.ts'], allowed).ok, false);
});

test('checkTestContent는 건너뛰기가 늘거나 단언이 없거나 줄면 실패한다', () => {
  const good = "it('a', () => {\n  expect(1).toBe(1);\n});\n";

  assert.equal(checkTestContent(good, '', PATTERNS).ok, true);
  assert.equal(checkTestContent("it('a', () => {});\n", '', PATTERNS).ok, false);
  assert.equal(checkTestContent(`it.skip('b', () => {});\n${good}`, '', PATTERNS).ok, false);
  assert.equal(checkTestContent(good, `${good}expect(2).toBe(2);\n`, PATTERNS).ok, false);
  assert.equal(checkTestContent(`${good}expect(2).toBe(2);\n`, good, PATTERNS).ok, true);
});

test('budgetLeft는 실행 상한과 합계 상한 중 작은 쪽에서 쓴 만큼 빼고 0 밑으로 내려가지 않는다', () => {
  const base = { runBudget: 3, totalBudget: 15 };

  assert.equal(budgetLeft({ ...base, spentBefore: 0, spentThisRun: 1 }), 2);
  assert.equal(budgetLeft({ ...base, spentBefore: 14, spentThisRun: 0 }), 1);
  assert.equal(budgetLeft({ ...base, spentBefore: 14, spentThisRun: 2 }), 0);
  assert.equal(budgetLeft({ ...base, spentBefore: 16, spentThisRun: 0 }), 0);
});

test('sumSpent는 실행 폴더의 비용을 더하고, 결과가 없는 폴더와 없는 경로는 0으로 본다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-loop-'));

  assert.equal(sumSpent(path.join(dir, 'missing')), 0);

  for (const [name, costUsd] of [
    ['a', 1.5],
    ['b', 0.25],
  ]) {
    fs.mkdirSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, name, 'result.json'), JSON.stringify({ costUsd }));
  }

  fs.mkdirSync(path.join(dir, 'crashed'));

  assert.equal(sumSpent(dir), 1.75);
});

test('isInClone은 클론 안의 스크립트만 인정한다(이름이 비슷한 형제 폴더 포함)', () => {
  assert.equal(isInClone('/h/loop-lab/fe/.claude/scripts/x.mjs', '/h/loop-lab/fe'), true);
  assert.equal(isInClone('/h/loop-lab/fe-old/.claude/scripts/x.mjs', '/h/loop-lab/fe'), false);
  assert.equal(isInClone('/h/repo/.claude/scripts/x.mjs', '/h/loop-lab/fe'), false);
});

test('agentStop은 상한·오류·보고 상태를 종료 사유로 바꾸고 done·equivalent만 이어 간다', () => {
  const success = (status) => ({ subtype: 'success', structured_output: { status } });

  assert.equal(agentStop({ subtype: 'error_max_turns' }), 'turn-limit');
  assert.equal(agentStop({ subtype: 'error_max_budget_usd' }), 'budget-limit');
  assert.equal(agentStop({ subtype: 'error_during_execution' }), 'agent-error');
  assert.equal(agentStop(null), 'agent-error');
  assert.equal(agentStop({ subtype: 'success' }), 'agent-error');
  assert.equal(agentStop(success('suspected-bug')), 'suspected-bug');
  assert.equal(agentStop(success('blocked')), 'blocked');
  assert.equal(agentStop(success('done')), null);
  assert.equal(agentStop(success('equivalent')), null);
});

test('afterRemeasure는 등가 보고, 남은 뮤턴트 0, 재측정 2회, 예산 소진에서 멈춘다', () => {
  const base = { status: 'done', remaining: 3, remeasures: 1, left: 1 };

  assert.equal(afterRemeasure(base), null);
  assert.equal(afterRemeasure({ ...base, status: 'equivalent' }), 'equivalent');
  assert.equal(afterRemeasure({ ...base, remaining: 0 }), 'no-survivors');
  assert.equal(afterRemeasure({ ...base, remeasures: 2 }), 'remeasure-limit');
  assert.equal(afterRemeasure({ ...base, left: 0 }), 'budget-limit');
});

test('buildSettings는 대상 테스트만 쓰기를 허용하고 .git·.claude 쓰기를 막으며 원본을 바꾸지 않는다', () => {
  const base = JSON.parse(
    fs.readFileSync(new URL('../loops/mutation/settings.json', import.meta.url), 'utf8')
  );
  const original = structuredClone(base);
  const settings = buildSettings(base, {
    cloneDir: '/h/fe',
    testFiles: ['src/a.test.ts', 'src/a.test.tsx'],
  });

  assert.deepEqual(base, original);
  assert.equal(settings.disableAllHooks, true);
  assert.equal(settings.sandbox.autoAllowBashIfSandboxed, false);
  assert.deepEqual(settings.sandbox.filesystem.denyRead, base.sandbox.filesystem.denyRead);
  assert.deepEqual(settings.sandbox.filesystem.denyWrite, ['/h/fe/.git', '/h/fe/.claude']);
  assert.ok(settings.permissions.allow.includes('Edit(//h/fe/src/a.test.ts)'));
  assert.ok(settings.permissions.allow.includes('Edit(//h/fe/src/a.test.tsx)'));
  assert.ok(settings.permissions.allow.every((rule) => !/^Bash\((git|gh)\b/.test(rule)));
});

test('loopEnv는 허용한 변수만 넘기고 비밀 값은 넘기지 않는다', () => {
  const env = loopEnv({
    PATH: '/bin',
    HOME: '/h',
    PGPASSWORD: 'x',
    GITHUB_TOKEN: 'y',
    AWS_SECRET_ACCESS_KEY: 'z',
  });

  assert.deepEqual(env, { PATH: '/bin', HOME: '/h', VITE_API_BASE_URL: 'http://localhost' });
});

test('renderReport는 전후 수치·에이전트 보고·검증 결과를 담고, 측정이 없어도 깨지지 않는다', () => {
  const base = {
    target: 'src/a.ts',
    outcome: 'remeasure-limit',
    models: ['claude-sonnet-5-5'],
    costUsd: 1.234,
    turns: 12,
    agentCalls: 3,
    baseCommit: 'abc',
    agent: {
      status: 'done',
      summary: '요약',
      findings: [{ line: 7, reason: '이유' }],
    },
    measures: [
      { killed: 1, survived: 2, noCoverage: 3, score: 33.3, remaining: [] },
      { killed: 5, survived: 1, noCoverage: 0, score: 83.3, remaining: [] },
    ],
    checks: { 경로: { ok: true, detail: 'src/a.test.ts' } },
    final: { 'unit 전체': { ok: false, detail: 'logs/final-unit.log' } },
  };
  const report = renderReport(base);

  assert.match(report, /# src\/a\.ts: remeasure-limit/);
  assert.match(report, /\$1\.23/);
  assert.match(report, /\| 기준값 \| 1 \| 2 \| 3 \| 33\.3% \|/);
  assert.match(report, /\| 재측정 1 \| 5 \| 1 \| 0 \| 83\.3% \|/);
  assert.match(report, /7줄: 이유/);
  assert.match(report, /\| 경로 \| 통과 \| src\/a\.test\.ts \|/);
  assert.match(report, /\| unit 전체 \| 실패 \| logs\/final-unit\.log \|/);
  assert.doesNotThrow(() =>
    renderReport({ ...base, agent: null, measures: [], checks: {}, final: {}, models: [] })
  );

  // 남은 뮤턴트 칸은 남은 것이 있을 때만 나온다.
  assert.doesNotMatch(report, /남은 뮤턴트/);

  const remaining = [{ status: 'Survived', line: 3, column: 2, replacement: 'x' }];
  const withRemaining = renderReport({
    ...base,
    measures: [{ killed: 1, survived: 1, noCoverage: 0, score: 50, remaining }],
  });

  assert.match(withRemaining, /## 남은 뮤턴트/);
  assert.match(withRemaining, /3:2/);
});
