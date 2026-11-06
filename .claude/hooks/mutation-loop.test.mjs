// 뮤테이션 루프 래퍼(mutation-loop.mjs)의 판정 함수 회귀 테스트.
// 실행: node --test .claude/hooks/mutation-loop.test.mjs (docs/plans/2026-11-06-mutation-loop-l2.md)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { findPrBodyProblems } from '../../scripts/lib/pr-body.js';
import {
  addedLines,
  afterRemeasure,
  agentStop,
  branchFor,
  budgetLeft,
  buildSettings,
  checkChangedPaths,
  checkTestContent,
  commitSubject,
  decideRunGate,
  fillPrompt,
  findForbiddenSyntax,
  findLeakedValues,
  findRandomStrings,
  formatMutants,
  isInClone,
  loopEnv,
  modelLabel,
  parseChangedPaths,
  readyToPublish,
  refspecFor,
  renderPrBody,
  renderReport,
  reviewPatch,
  sumSpent,
  summarizeMutants,
  testFilesFor,
  validatePatch,
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

const TEST_FILE = 'src/a/useB.test.ts';
const ALLOWED = testFilesFor('src/a/useB.ts');
const NEW_FILE_HEADER = ['new file mode 100644', 'index 0000000..abc1234', '--- /dev/null'];

/** git diff가 내는 모양의 patch. 헤더만 바꿔 거부 경로를 만든다. */
const patchFor = (lines, { file = TEST_FILE, header = NEW_FILE_HEADER } = {}) =>
  [
    `diff --git a/${file} b/${file}`,
    ...header,
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
    '',
  ].join('\n');

// 값은 실제 비밀이 아니라 검사 조건에 맞춰 만든 가짜 문자열이다.
const FAKE_TOKEN = ['a1B2c3D4e5F6g7H8', 'i9J0k1L2m3N4o5P6', 'q7R8s9T0'].join('');

const PUBLISHABLE = {
  target: 'src/a/useB.ts',
  outcome: 'no-survivors',
  models: ['claude-sonnet-5-5'],
  costUsd: 0.5,
  turns: 12,
  agentCalls: 1,
  baseCommit: 'abc',
  agent: { status: 'done', summary: '@someone Closes #1 요약', findings: [] },
  measures: [
    { killed: 1, survived: 2, noCoverage: 3, score: 33.3, remaining: [] },
    { killed: 6, survived: 0, noCoverage: 0, score: 100, remaining: [] },
  ],
  checks: { 경로: { ok: true, detail: TEST_FILE }, 단언: { ok: true, detail: '단언 3줄' } },
  final: { '10회 반복': { ok: true, detail: '10/10' }, 'unit 전체': { ok: true, detail: '' } },
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
    tmpRoot: '/private/tmp/claude-1',
  });

  assert.deepEqual(base, original);
  assert.equal(settings.disableAllHooks, true);
  assert.equal(settings.sandbox.autoAllowBashIfSandboxed, false);
  assert.deepEqual(settings.sandbox.credentials.envVars, [
    { name: 'CLAUDE_CODE_MESSAGING_TOKEN', mode: 'deny' },
  ]);
  assert.deepEqual(settings.sandbox.filesystem.denyRead, [
    '~/',
    '/private/tmp/claude-1/-Users-*',
    '/private/tmp/claude-1/-private-*',
    '/private/tmp/claude-1/bash-edit-diff',
  ]);
  assert.deepEqual(settings.sandbox.filesystem.allowRead, [
    '~/.nvm/versions/node',
    '/h/fe',
    '/private/tmp/claude-1/-h-fe',
  ]);
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

  // 공개 결과는 있을 때 주소나 막힌 이유를 보여 준다.
  assert.match(report, /- 공개: -/);
  assert.match(
    renderReport({ ...base, published: { ok: true, url: 'https://x/pull/1' } }),
    /- 공개: https:\/\/x\/pull\/1/
  );
  assert.match(
    renderReport({ ...base, published: { ok: false, detail: '위험 문법: fetch(' } }),
    /- 공개: 위험 문법: fetch\(/
  );
});

test('validatePatch는 허용된 경로의 일반 파일 하나만 통과시킨다', () => {
  const edited = ['index abc1234..def5678 100644', `--- a/${TEST_FILE}`];

  assert.deepEqual(validatePatch(patchFor(['x']), ALLOWED), { ok: true, detail: TEST_FILE });
  assert.equal(validatePatch(patchFor(['x'], { header: edited }), ALLOWED).ok, true);
});

test('validatePatch는 파일 2개·심볼릭 링크·실행 권한·바이너리·이름 변경·삭제·권한 변경을 거부한다', () => {
  const headers = {
    symlink: ['new file mode 120000', 'index 0000000..abc1234', '--- /dev/null'],
    executable: ['new file mode 100755', 'index 0000000..abc1234', '--- /dev/null'],
    editedSymlink: ['index abc1234..def5678 120000', `--- a/${TEST_FILE}`],
    rename: ['similarity index 90%', 'rename from src/a/x.ts', `rename to ${TEST_FILE}`],
    copy: ['similarity index 90%', 'copy from src/a/x.ts', `copy to ${TEST_FILE}`],
    deleted: ['deleted file mode 100644', 'index abc1234..0000000', `--- a/${TEST_FILE}`],
    modeChange: ['old mode 100644', 'new mode 100755'],
    binary: ['new file mode 100644', 'index 0000000..abc1234', 'GIT binary patch'],
  };

  for (const [name, header] of Object.entries(headers)) {
    assert.equal(validatePatch(patchFor(['x'], { header }), ALLOWED).ok, false, name);
  }

  assert.equal(validatePatch(`${patchFor(['x'])}${patchFor(['y'])}`, ALLOWED).ok, false);
  assert.equal(validatePatch('', ALLOWED).ok, false);
});

test('validatePatch는 경로가 다르거나 따옴표로 감싸였으면 거부하고, 내용 줄에 속지 않는다', () => {
  assert.equal(validatePatch(patchFor(['x'], { file: 'src/a/useB.ts' }), ALLOWED).ok, false);
  assert.equal(validatePatch(patchFor(['x'], { file: 'src/a/useC.test.ts' }), ALLOWED).ok, false);
  assert.equal(
    validatePatch(
      patchFor(['x'], { header: ['index a..b 100644', '--- a/src/a/other.ts'] }),
      ALLOWED
    ).ok,
    false
  );

  const quoted = [
    'diff --git "a/src/a/useB.test.ts" "b/src/a/useB.test.ts"',
    ...NEW_FILE_HEADER,
    '+++ "b/src/a/useB.test.ts"',
    '@@ -0,0 +1,1 @@',
    `+++ b/${TEST_FILE}`,
    '',
  ].join('\n');

  assert.equal(validatePatch(quoted, ALLOWED).ok, false);
  assert.equal(validatePatch(patchFor(['rename from x', 'GIT binary patch']), ALLOWED).ok, true);
});

test('addedLines는 더한 줄만 내고 `+++ `로 시작하는 내용 줄도 빠뜨리지 않는다', () => {
  const patch = [
    `diff --git a/${TEST_FILE} b/${TEST_FILE}`,
    'index a..b 100644',
    `--- a/${TEST_FILE}`,
    `+++ b/${TEST_FILE}`,
    '@@ -1,2 +1,3 @@',
    ' 그대로',
    '-지운 줄',
    '+더한 줄',
    '+++ fetch("x")',
    '',
  ].join('\n');

  assert.deepEqual(addedLines(patch), ['더한 줄', '++ fetch("x")']);
  assert.deepEqual(addedLines(''), []);
});

test('findForbiddenSyntax는 위험 문법을 이름으로 알리고 비슷한 이름에는 걸리지 않는다', () => {
  const cases = {
    'process.env.X': 'process.',
    "import cp from 'child_process'": 'child_process',
    "import fs from 'node:fs'": 'node 내장 import',
    "import fs from 'fs'": 'node 내장 import',
    "await import('fs/promises')": 'node 내장 import',
    "require('x')": 'require(',
    'eval("x")': 'eval(',
    'new Function("x")': 'new Function',
    'fetch("https://x")': 'fetch(',
    RUNNER_TEMP: 'RUNNER_TEMP',
    ACTIONS_ID_TOKEN_REQUEST_URL: 'ACTIONS_',
    GITHUB_TOKEN: 'GITHUB_',
  };

  for (const [code, label] of Object.entries(cases)) {
    assert.ok(findForbiddenSyntax(code).includes(label), code);
  }

  const harmless = [
    "import { x } from '@/shared/utils/util';",
    "import { y } from './fs';",
    'const { refetch } = useQuery(); await refetch();',
    'prefetch(); processItem.run(); evaluate(1); requireAuth();',
    "expect(import.meta.env.DEV).toBe(true); vi.mock('@/a');",
  ].join('\n');

  assert.deepEqual(findForbiddenSyntax(harmless), []);
});

test('findLeakedValues는 값이 같은 이름만 내고 짧은 값은 우연으로 본다', () => {
  const secrets = { TOKEN: FAKE_TOKEN, SHORT: 'abc', EMPTY: '', MISSING: undefined };

  assert.deepEqual(findLeakedValues(`const a = '${FAKE_TOKEN}abc';`, secrets), ['TOKEN']);
  assert.deepEqual(findLeakedValues('const a = 1;', secrets), []);
});

test('findRandomStrings는 긴 무작위 문자열만 세고 경로·긴 이름은 세지 않는다', () => {
  assert.equal(findRandomStrings(`const a = '${FAKE_TOKEN}';`), 1);
  assert.equal(findRandomStrings("import x from '@/widgets/post/post-card/hooks/usePostCard';"), 0);
  assert.equal(findRandomStrings("it('handleCreateAndSelectBookmarkFolderDialogOpen', f);"), 0);
  assert.equal(findRandomStrings(`const a = '${'a1'.repeat(20)}';`), 0);
  assert.equal(findRandomStrings("const short = 'a1B2c3D4';"), 0);
});

test('reviewPatch는 더한 줄을 검사하고 막힌 이유에 값을 남기지 않는다', () => {
  const review = (lines) =>
    reviewPatch(patchFor(lines), { allowed: ALLOWED, secrets: { 'gh auth token': FAKE_TOKEN } });

  assert.deepEqual(review(['expect(1).toBe(1);']), { ok: true, detail: TEST_FILE });
  assert.match(review(['process.env.X']).detail, /위험 문법: process\./);
  assert.match(review(['+ fetch("x")']).detail, /위험 문법: fetch\(/);

  const leaked = review([`const a = '${FAKE_TOKEN}';`]);

  assert.equal(leaked.ok, false);
  assert.match(leaked.detail, /gh auth token/);
  assert.ok(!leaked.detail.includes(FAKE_TOKEN));

  const random = reviewPatch(patchFor([`const a = '${FAKE_TOKEN}';`]), {
    allowed: ALLOWED,
    secrets: {},
  });

  assert.equal(random.ok, false);
  assert.ok(!random.detail.includes(FAKE_TOKEN));
  assert.equal(
    reviewPatch(patchFor(['x'], { file: 'src/a/useB.ts' }), { allowed: ALLOWED, secrets: {} }).ok,
    false
  );
});

test('decideRunGate는 열린 2개·전체 5개·연속 2건 닫힘에서 거부하고 다른 브랜치는 세지 않는다', () => {
  const pr = (state, closedAt = null, headRefName = 'loop/mutation/a') => ({
    state,
    closedAt,
    headRefName,
  });
  const merged = (day) => pr('MERGED', `2026-11-${day}T00:00:00Z`);
  const closed = (day) => pr('CLOSED', `2026-11-${day}T00:00:00Z`);

  assert.equal(decideRunGate([]).ok, true);
  assert.equal(decideRunGate([pr('OPEN')]).ok, true);
  assert.equal(decideRunGate([pr('OPEN'), pr('OPEN')]).ok, false);
  assert.equal(decideRunGate([pr('OPEN'), pr('OPEN', null, 'feature/x')]).ok, true);
  assert.equal(decideRunGate(['10', '11', '12', '13'].map(merged)).ok, true);
  assert.equal(decideRunGate(['10', '11', '12', '13', '14'].map(merged)).ok, false);
  assert.equal(decideRunGate([closed('10')]).ok, true);
  assert.equal(decideRunGate([closed('10'), closed('11')]).ok, false);
  assert.equal(decideRunGate([closed('10'), closed('11'), merged('12')]).ok, true);
  assert.equal(decideRunGate([merged('10'), closed('11'), closed('12')]).ok, false);
  assert.equal(
    decideRunGate([closed('10'), pr('CLOSED', '2026-11-12T00:00:00Z', 'feature/x')]).ok,
    true
  );
});

test('branchFor·refspecFor는 대상 이름이 main이어도 main 브랜치에 닿지 않는다', () => {
  assert.equal(branchFor('src/shared/hooks/useKeydown.ts'), 'loop/mutation/useKeydown');
  assert.equal(branchFor('src/main.tsx'), 'loop/mutation/main');
  assert.equal(refspecFor('src/main.ts'), 'HEAD:refs/heads/loop/mutation/main');
  assert.throws(() => branchFor('src/a b.ts'));
  assert.throws(() => branchFor('src/a;rm.ts'));
});

test('readyToPublish는 마지막 검증까지 돌아 모두 통과했을 때만 true다', () => {
  const failed = { ok: false, detail: '' };

  assert.equal(readyToPublish(PUBLISHABLE), true);
  assert.equal(readyToPublish({ ...PUBLISHABLE, final: {} }), false);
  assert.equal(readyToPublish({ ...PUBLISHABLE, outcome: 'wrapper-error' }), false);
  assert.equal(
    readyToPublish({ ...PUBLISHABLE, final: { ...PUBLISHABLE.final, 'unit 전체': failed } }),
    false
  );
  assert.equal(
    readyToPublish({ ...PUBLISHABLE, checks: { ...PUBLISHABLE.checks, 단언: failed } }),
    false
  );
});

test('commitSubject는 레이어에서 scope를 고른다', () => {
  assert.match(commitSubject('src/shared/hooks/useKeydown.ts'), /^test\(shared\): useKeydown /);
  assert.match(commitSubject('src/widgets/post/post-card/hooks/usePostCard.ts'), /^test\(post\): /);
  assert.match(commitSubject('src/pages/bookmark/hooks/useBookmarkPage.ts'), /^test\(bookmark\): /);
  assert.match(commitSubject('src/pages/404/use404.ts'), /^test\(shared\): /);
  assert.match(commitSubject('src/main.ts'), /^test\(shared\): main /);
});

test('modelLabel은 요청한 모델을 먼저 찾아 사람이 읽는 이름으로 바꾼다', () => {
  assert.equal(
    modelLabel(['claude-haiku-5-5', 'claude-sonnet-5-5'], 'sonnet'),
    'Claude Sonnet 5.5'
  );
  assert.equal(modelLabel(['claude-opus-5-5[1m]'], 'other'), 'Claude Opus 5.5');
  assert.equal(modelLabel([], 'sonnet'), 'Claude');
});

test('renderPrBody는 필수 절을 채우고 에이전트 문구를 싣지 않는다', () => {
  const template = fs.readFileSync(
    new URL('../../.github/pull_request_template.md', import.meta.url),
    'utf8'
  );
  const body = renderPrBody(PUBLISHABLE);

  assert.deepEqual(findPrBodyProblems(body, template), []);
  assert.doesNotMatch(body, /@someone|Closes #|계획 대비 구현/);
  assert.match(body, /살아남음\+안 닿음 5 → 0 \| 됐음/);
  assert.match(body, /청구액이 아닙니다/);
  assert.match(body, /Generated with \[Claude Code\]/);
  assert.match(
    renderPrBody({ ...PUBLISHABLE, measures: [PUBLISHABLE.measures[0], PUBLISHABLE.measures[0]] }),
    /이탈\(줄지 않음\)/
  );
});
