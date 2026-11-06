// 뮤테이션 테스트 자동 보강 루프(L2: draft PR까지). AI 루프 준비 Phase 2(docs/plans/2026-11-06-mutation-loop-l2.md).
// 파일 하나의 빈틈을 Stryker로 재고, claude -p에게 테스트를 쓰게 한 뒤, 검증과 재측정을 거쳐 클론 밖에 보고서를
// 남긴다. 검사를 모두 통과하면 테스트 파일 하나를 draft PR로 연다. 머지는 사람이 정하고 이 스크립트는 하지 않는다.
//
// - 별도 클론(~/project/loop-lab/fe)에 있는 이 파일로만 돈다. 다른 곳에서 실행하면 거부한다.
// - 에이전트가 쓴 코드를 실행하는 명령은 전부 Seatbelt(.claude/loops/mutation/verify.sb) 안에서 돌린다.
// - push는 에이전트 코드가 닿지 못하는 새 클론(~/project/loop-lab/publish)에 patch만 올려서 한다.
// - 로컬 전용이다 — CI나 package.json에 등록하지 않는다.
//
// 사용법(준비 절차는 docs/TESTING.md "자동 보강 루프"):
//   node ~/project/loop-lab/fe/.claude/scripts/mutation-loop.mjs <대상 파일> [--model sonnet] [--budget 3] [--no-push]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = os.homedir();
const CLONE_DIR = path.join(HOME, 'project/loop-lab/fe');
const RUNS_DIR = path.join(HOME, 'project/loop-lab/runs');
const PUBLISH_DIR = path.join(HOME, 'project/loop-lab/publish');
const LOOP_DIR = path.join(CLONE_DIR, '.claude/loops/mutation');
const REPO = 'BAECHAN/link-sphere_FE_NEW';
const BRANCH_PREFIX = 'loop/mutation/';
// 단언·건너뛰기 패턴의 정본. claude-base는 원격이 없어 CI에 없으므로 main()에서만 불러온다.
const TEST_PATTERNS = path.join(HOME, 'project/claude-base/lib/test-patterns.mjs');

// 상한은 계획에서 사용자가 고른 값이다. 달러는 청구액이 아니라 사용량을 목록가로 환산한 값이다(구독 로그인).
const TOTAL_BUDGET_USD = 15;
const DEFAULT_RUN_BUDGET_USD = 3;
const MAX_TURNS = 30;
const MAX_REMEASURES = 2;
const REPEAT_RUNS = 10;
const AGENT_TIMEOUT_MS = 30 * 60 * 1000;

// draft PR 상한도 계획에서 정한 값이다. 우회 플래그를 두지 않는다.
const MAX_OPEN_PRS = 2;
const MAX_TOTAL_PRS = 5;
const MAX_CONSECUTIVE_CLOSED = 2;

// 긴 무작위 문자열과 값 대조의 기준. 경로를 피하려고 `/`를 뺀다(기존 테스트 185개 중 넣으면 10개, 빼면 2개가 걸린다. 직접 측정 2026-11-06).
const RANDOM_TOKEN = /[A-Za-z0-9_+=-]{32,}/g;
const MIN_TOKEN_ENTROPY = 4;
const MIN_SECRET_LENGTH = 16;

const BUILTIN_IMPORT = new RegExp(
  `(?:\\bfrom\\s*|\\bimport\\s*\\(?\\s*)['"\`](?:node:[^'"\`]+|(?:${builtinModules.join('|')})(?:/[^'"\`]*)?)['"\`]`
);

/** 있으면 공개하지 않는 문법. 우회할 수 있는 1차 방어이고, 우회 코드는 읽을 때 눈에 띈다. */
const FORBIDDEN_SYNTAX = [
  ['process.', /\bprocess\s*\./],
  ['child_process', /child_process/],
  ['node 내장 import', BUILTIN_IMPORT],
  ['require(', /\brequire\s*\(/],
  ['eval(', /\beval\s*\(/],
  ['new Function', /\bnew\s+Function\b/],
  ['fetch(', /\bfetch\s*\(/],
  ['RUNNER_TEMP', /RUNNER_TEMP/],
  ['ACTIONS_', /ACTIONS_/],
  ['GITHUB_', /GITHUB_/],
];

const FORBIDDEN_PATCH_HEADER =
  /^(?:rename |copy |similarity index |dissimilarity index |deleted file mode |old mode |new mode |GIT binary patch|Binary files )/m;

const VITEST = ['pnpm', 'exec', 'vitest', 'run', '--config', 'vitest.stryker.config.ts'];
const ENV_KEEP = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'TMPDIR', 'TERM'];

export const STATUS_SCHEMA = {
  type: 'object',
  properties: {
    status: { enum: ['done', 'suspected-bug', 'equivalent', 'blocked'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { line: { type: 'integer' }, reason: { type: 'string' } },
        required: ['reason'],
      },
    },
  },
  required: ['status', 'summary', 'findings'],
};

/** Stryker JSON 보고서에서 파일 하나의 집계와 아직 안 잡힌 뮤턴트를 뽑는다. */
export function summarizeMutants(report, target) {
  const file = report.files[target];

  if (!file) {
    throw new Error(`보고서에 ${target}이 없다`);
  }

  const counts = { killed: 0, survived: 0, noCoverage: 0, other: 0 };
  const remaining = [];

  for (const mutant of file.mutants) {
    if (mutant.status === 'Killed' || mutant.status === 'Timeout') {
      counts.killed += 1;
    } else if (mutant.status === 'Survived' || mutant.status === 'NoCoverage') {
      counts[mutant.status === 'Survived' ? 'survived' : 'noCoverage'] += 1;
      remaining.push({
        status: mutant.status,
        line: mutant.location.start.line,
        column: mutant.location.start.column,
        mutator: mutant.mutatorName,
        replacement: mutant.replacement,
      });
    } else {
      counts.other += 1;
    }
  }

  const covered = counts.killed + counts.survived;
  const score = covered ? Math.round((counts.killed / covered) * 1000) / 10 : null;

  return { ...counts, score, remaining };
}

/** 프롬프트에 넣을 뮤턴트 목록. 긴 치환 코드는 한 줄로 줄인다. */
export function formatMutants(remaining) {
  return remaining
    .map((m) => {
      const code = (m.replacement ?? '').replace(/\s+/g, ' ').slice(0, 60);

      return `${m.line}:${m.column} [${m.status}] ${m.mutator} → ${code}`;
    })
    .join('\n');
}

export function fillPrompt(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
}

/** 대상 옆의 테스트 파일 이름. 쓸 수 있는 파일은 이 둘뿐이다. */
export function testFilesFor(target) {
  const base = target.replace(/\.tsx?$/, '');

  return [`${base}.test.ts`, `${base}.test.tsx`];
}

/** `git status --porcelain -uall` 출력을 경로 목록으로 바꾼다. 이름 변경은 양쪽을 다 넣는다. */
export function parseChangedPaths(porcelain) {
  return porcelain
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => line.slice(3).split(' -> '))
    .map((p) => p.replace(/^"|"$/g, ''));
}

export function checkChangedPaths(changed, allowed) {
  const unexpected = changed.filter((p) => !allowed.includes(p));

  if (unexpected.length > 0) {
    return { ok: false, detail: `허용되지 않은 경로: ${unexpected.join(', ')}` };
  }

  if (changed.length !== 1) {
    return { ok: false, detail: `테스트 파일이 ${changed.length}개다(1개여야 한다)` };
  }

  return { ok: true, detail: changed[0] };
}

/** 건너뛰기 표기가 늘거나 단언이 줄면 실패다. 패턴은 lib/test-patterns.mjs를 인자로 받는다. */
export function checkTestContent(text, baseline, { ASSERTION_LINE, SKIP_LINE, countLines }) {
  const skips = countLines(text, SKIP_LINE);
  const assertions = countLines(text, ASSERTION_LINE);

  if (skips > countLines(baseline, SKIP_LINE)) {
    return { ok: false, detail: `건너뛰기 표기 ${skips}줄` };
  }

  if (assertions === 0 || assertions < countLines(baseline, ASSERTION_LINE)) {
    return { ok: false, detail: `단언 ${assertions}줄` };
  }

  return { ok: true, detail: `단언 ${assertions}줄` };
}

/** 이번 실행에 쓸 수 있는 값. 실행 상한과 합계 상한 중 작은 쪽에서 쓴 만큼 뺀다. */
export function budgetLeft({ runBudget, totalBudget, spentBefore, spentThisRun }) {
  return Math.max(0, Math.min(runBudget, totalBudget - spentBefore) - spentThisRun);
}

export function isInClone(scriptPath, cloneDir) {
  return scriptPath.startsWith(`${cloneDir}${path.sep}`);
}

/** claude -p 결과에서 루프를 멈출 사유를 찾는다. 없으면 null. */
export function agentStop(output) {
  if (output?.subtype === 'error_max_turns') {
    return 'turn-limit';
  }

  if (output?.subtype === 'error_max_budget_usd') {
    return 'budget-limit';
  }

  const status = output?.subtype === 'success' ? output.structured_output?.status : null;

  if (status === 'suspected-bug' || status === 'blocked') {
    return status;
  }

  return status === 'done' || status === 'equivalent' ? null : 'agent-error';
}

/** 재측정 뒤 멈출 사유. 없으면 null이고 남은 목록을 에이전트에게 다시 준다. */
export function afterRemeasure({ status, remaining, remeasures, left }) {
  if (status === 'equivalent') {
    return 'equivalent';
  }

  if (remaining === 0) {
    return 'no-survivors';
  }

  if (remeasures >= MAX_REMEASURES) {
    return 'remeasure-limit';
  }

  return left <= 0 ? 'budget-limit' : null;
}

/**
 * 저장소의 settings.json에 이 실행의 경로를 덧붙인다.
 *
 * tmpRoot(/private/tmp/claude-<uid>)의 다른 세션 폴더는 읽지 못하게 하되 통째로 막지는 않는다. Claude 샌드박스의 TMPDIR이
 * 이 폴더라 vitest 임시 파일이 여기 생기고, 에이전트 자신의 폴더를 막으면 Bash 출력 파일 fstat이 실패해 node가 abort한다
 * (직접 측정 2026-11-06, 종료 코드 134). 허용 경로는 glob이면 듣지 않아 글자 그대로 적는다(같은 측정).
 */
export function buildSettings(base, { cloneDir, testFiles, tmpRoot }) {
  const { filesystem } = base.sandbox;

  return {
    ...base,
    sandbox: {
      ...base.sandbox,
      filesystem: {
        ...filesystem,
        denyRead: [
          ...filesystem.denyRead,
          `${tmpRoot}/-Users-*`,
          `${tmpRoot}/-private-*`,
          `${tmpRoot}/bash-edit-diff`,
        ],
        allowRead: [
          ...filesystem.allowRead,
          cloneDir,
          path.join(tmpRoot, cloneDir.replace(/[^A-Za-z0-9]/g, '-')),
        ],
        denyWrite: [path.join(cloneDir, '.git'), path.join(cloneDir, '.claude')],
      },
    },
    permissions: {
      ...base.permissions,
      allow: [
        ...base.permissions.allow,
        ...testFiles.map((file) => `Edit(/${path.join(cloneDir, file)})`),
      ],
    },
  };
}

/**
 * 자식 프로세스에 넘길 환경 변수. 터미널의 PGPASSWORD·토큰 같은 값을 넘기지 않는다.
 * VITE_API_BASE_URL은 .env 없는 클론에서 vite 프록시 대상이 비지 않게 채운다(요청은 나가지 않는다).
 */
export function loopEnv(env) {
  const kept = ENV_KEEP.filter((key) => env[key]).map((key) => [key, env[key]]);

  return { ...Object.fromEntries(kept), VITE_API_BASE_URL: 'http://localhost' };
}

/** 이전 실행들의 result.json 비용을 더한다. */
export function sumSpent(runsDir) {
  if (!fs.existsSync(runsDir)) {
    return 0;
  }

  return fs
    .readdirSync(runsDir)
    .map((name) => path.join(runsDir, name, 'result.json'))
    .filter((file) => fs.existsSync(file))
    .reduce((sum, file) => sum + JSON.parse(fs.readFileSync(file, 'utf8')).costUsd, 0);
}

/** 이번 실행을 시작해도 되는지 본다. prs는 `gh pr list --state all`의 결과이고 루프 브랜치만 센다. */
export function decideRunGate(prs) {
  const loopPrs = prs.filter((pr) => pr.headRefName.startsWith(BRANCH_PREFIX));
  const open = loopPrs.filter((pr) => pr.state === 'OPEN').length;

  if (open >= MAX_OPEN_PRS) {
    return { ok: false, detail: `열린 루프 PR이 ${open}개다(${MAX_OPEN_PRS}개 미만이어야 한다)` };
  }

  if (loopPrs.length >= MAX_TOTAL_PRS) {
    return {
      ok: false,
      detail: `루프 PR이 모두 ${loopPrs.length}개다(${MAX_TOTAL_PRS}개 미만이어야 한다)`,
    };
  }

  const recent = loopPrs
    .filter((pr) => pr.state !== 'OPEN')
    .toSorted((a, b) => b.closedAt.localeCompare(a.closedAt))
    .slice(0, MAX_CONSECUTIVE_CLOSED);

  if (recent.length === MAX_CONSECUTIVE_CLOSED && recent.every((pr) => pr.state === 'CLOSED')) {
    return { ok: false, detail: `직전 ${MAX_CONSECUTIVE_CLOSED}건이 머지 없이 닫혔다` };
  }

  return { ok: true, detail: `열린 ${open}개, 모두 ${loopPrs.length}개` };
}

/** patch에서 더해진 줄만 뽑는다. 헤더 뒤에서만 세므로 `++ x`처럼 시작하는 내용 줄도 빠지지 않는다. */
export function addedLines(patch) {
  const hunks = patch.indexOf('\n@@');

  if (hunks === -1) {
    return [];
  }

  return patch
    .slice(hunks + 1)
    .split('\n')
    .filter((line) => line.startsWith('+'))
    .map((line) => line.slice(1));
}

/** 실제로 올릴 patch의 모양을 본다. 허용된 경로의 일반 파일 하나만 통과시킨다. */
export function validatePatch(patch, allowed) {
  const files = patch.match(/^diff --git /gm)?.length ?? 0;

  if (files !== 1) {
    return { ok: false, detail: `patch의 파일이 ${files}개다(1개여야 한다)` };
  }

  // 내용 줄이 헤더처럼 읽히지 않게 첫 hunk 앞만 본다. 따옴표 경로는 아래 정규식이 안 맞아 거부된다.
  const hunks = patch.indexOf('\n@@');
  const header = hunks === -1 ? patch : patch.slice(0, hunks);

  if (FORBIDDEN_PATCH_HEADER.test(header)) {
    return { ok: false, detail: '이름 변경·삭제·권한 변경·바이너리는 올리지 않는다' };
  }

  const mode = /^new file mode (\d+)$/m.exec(header)?.[1] ?? /^index \S+ (\d+)$/m.exec(header)?.[1];

  if (mode !== '100644') {
    return { ok: false, detail: `일반 파일이 아니다(mode ${mode})` };
  }

  const file = /^\+\+\+ b\/(.+)$/m.exec(header)?.[1];
  const from = /^--- (.+)$/m.exec(header)?.[1];

  if (!allowed.includes(file) || (from !== '/dev/null' && from !== `a/${file}`)) {
    return { ok: false, detail: `허용되지 않은 경로: ${file}` };
  }

  return { ok: true, detail: file };
}

export function findForbiddenSyntax(text) {
  return FORBIDDEN_SYNTAX.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

/** 값과 일치하는 이름만 돌려준다. 값 자체는 어디에도 남기지 않는다. 짧은 값은 우연히 겹쳐 뺀다. */
export function findLeakedValues(text, secrets) {
  return Object.entries(secrets)
    .filter(([, value]) => value?.length >= MIN_SECRET_LENGTH && text.includes(value))
    .map(([name]) => name);
}

function shannonEntropy(text) {
  const counts = new Map();

  for (const char of text) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }

  return [...counts.values()].reduce(
    (sum, count) => sum - (count / text.length) * Math.log2(count / text.length),
    0
  );
}

/** 형식이 알려지지 않은 토큰을 잡으려는 검사. 몇 개인지만 돌려준다. */
export function findRandomStrings(text) {
  return (text.match(RANDOM_TOKEN) ?? []).filter(
    (token) => /\d/.test(token) && shannonEntropy(token) >= MIN_TOKEN_ENTROPY
  ).length;
}

/** 올릴 patch 자체를 검사한다. 하나라도 걸리면 열지 않는다. */
export function reviewPatch(patch, { allowed, secrets }) {
  const shape = validatePatch(patch, allowed);

  if (!shape.ok) {
    return shape;
  }

  const added = addedLines(patch).join('\n');
  const syntax = findForbiddenSyntax(added);

  if (syntax.length > 0) {
    return { ok: false, detail: `위험 문법: ${syntax.join(', ')}` };
  }

  const leaked = findLeakedValues(added, secrets);

  if (leaked.length > 0) {
    return { ok: false, detail: `환경 값과 일치: ${leaked.join(', ')}` };
  }

  const random = findRandomStrings(added);

  if (random > 0) {
    return { ok: false, detail: `긴 무작위 문자열 ${random}개` };
  }

  return shape;
}

/** 마지막 검증까지 돌아 전부 통과했을 때만 true다. 중간에 멈춘 실행은 final이 비어 있다. */
export function readyToPublish(result) {
  const final = Object.values(result.final);

  return (
    result.outcome !== 'wrapper-error' &&
    final.length > 0 &&
    [...Object.values(result.checks), ...final].every((c) => c.ok)
  );
}

/** 항상 루프 접두사 아래의 브랜치다. 대상 이름이 main이어도 main에 닿지 않는다. */
export function branchFor(target) {
  const name = path.basename(target).replace(/\.tsx?$/, '');

  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error(`브랜치 이름으로 쓸 수 없는 대상이다: ${target}`);
  }

  return `${BRANCH_PREFIX}${name}`;
}

export function refspecFor(target) {
  return `HEAD:refs/heads/${branchFor(target)}`;
}

export function commitSubject(target) {
  const [, layer, domain] = target.split('/');
  const scope = layer !== 'shared' && /^[a-z]+$/.test(domain ?? '') ? domain : 'shared';
  const name = path.basename(target).replace(/\.tsx?$/, '');

  return `test(${scope}): ${name} 뮤테이션 빈틈을 메우는 테스트 추가`;
}

/** `claude-sonnet-5-5` → `Claude Sonnet 5.5`. 내부 작업용 모델도 함께 잡혀 요청한 모델을 먼저 찾는다. */
export function modelLabel(models, requested) {
  const id = models.find((model) => model.includes(requested)) ?? models[0] ?? '';
  const match = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(id);

  if (!match) {
    return 'Claude';
  }

  return `Claude ${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2]}.${match[3]}`;
}

function measureTable(measures) {
  return [
    '| 측정 | 죽음 | 살아남음 | 안 닿음 | 점수 |',
    '| --- | --- | --- | --- | --- |',
    ...measures.map(
      (m, i) =>
        `| ${i === 0 ? '기준값' : `재측정 ${i}`} | ${m.killed} | ${m.survived} | ${m.noCoverage} | ${m.score ?? '-'}% |`
    ),
  ];
}

function checkTable(result) {
  return [
    '| 항목 | 결과 | 비고 |',
    '| --- | --- | --- |',
    ...Object.entries({ ...result.checks, ...result.final }).map(
      ([name, check]) => `| ${name} | ${check.ok ? '통과' : '실패'} | ${check.detail ?? ''} |`
    ),
  ];
}

/** PR 본문은 수치와 고정 문구만 쓴다. 에이전트 문구를 넣으면 멘션과 `Closes #N`이 실제로 작동한다. */
export function renderPrBody(result) {
  const testFile = result.checks.경로.detail;
  const gaps = (m) => m.survived + m.noCoverage;
  const before = gaps(result.measures[0]);
  const after = gaps(result.measures.at(-1));

  return [
    '## 요약',
    '',
    `뮤테이션 테스트 자동 보강 루프가 열었습니다. \`${result.target}\`의 빈틈을 메우는 테스트 파일 \`${testFile}\` 하나를 더합니다.`,
    '점수는 품질의 증거가 아닙니다. 머지 여부는 사람이 테스트를 읽고 정합니다.',
    '',
    ...measureTable(result.measures),
    '',
    '## 영향 범위',
    '',
    '- 테스트 파일 하나만 바뀝니다. 앱 코드와 데이터 계약은 그대로입니다.',
    '- 병합하면 테스트만 바뀌어도 운영 배포가 한 번 돕니다(`deploy.yml` 경로 필터). 앱 결과물은 같습니다.',
    '',
    '## 의도 대비 결과',
    '',
    `계획: [\`docs/plans/2026-11-06-mutation-loop-l2.md\`](https://github.com/${REPO}/blob/main/docs/plans/2026-11-06-mutation-loop-l2.md)`,
    '',
    '| 의도 | 결과 | 판정 |',
    '| --- | --- | --- |',
    `| 테스트 파일 하나만 더한다 | \`${testFile}\` | 됐음 |`,
    `| 남은 뮤턴트를 줄인다 | 살아남음+안 닿음 ${before} → ${after} | ${after < before ? '됐음' : '이탈(줄지 않음)'} |`,
    '| 테스트가 실제 동작을 지킨다 | 사람이 읽기 전입니다 | 아직 모름(사람이 읽고 머지·고쳐서 머지·닫기를 정합니다) |',
    '',
    '## 검증',
    '',
    `- 기준 커밋: \`${result.baseCommit}\``,
    `- 모델: ${result.models.join(', ')}, 턴 ${result.turns}, 호출 ${result.agentCalls}`,
    `- 사용량: $${result.costUsd.toFixed(2)}(목록가 환산값이고 청구액이 아닙니다)`,
    '- 공개 전 patch 검사(파일 1개, 일반 파일, 위험 문법, 환경 값 대조, 긴 무작위 문자열) 통과',
    '',
    ...checkTable(result),
    '',
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
    '',
  ].join('\n');
}

export function renderReport(result) {
  const agent = result.agent;
  const last = result.measures.at(-1);

  return [
    `# ${result.target}: ${result.outcome}`,
    '',
    `- 모델: ${result.models.join(', ') || '-'}`,
    `- 비용(목록가 환산): $${result.costUsd.toFixed(2)} / 턴 ${result.turns} / 호출 ${result.agentCalls}`,
    `- 기준 커밋: ${result.baseCommit}`,
    `- 공개: ${result.published?.url ?? result.published?.detail ?? '-'}`,
    '',
    '## 뮤턴트',
    '',
    ...measureTable(result.measures),
    '',
    '## 에이전트 보고',
    '',
    `- 상태: ${agent?.status ?? '-'}`,
    `- 요약: ${agent?.summary ?? '-'}`,
    ...(agent?.findings ?? []).map((f) => `- ${f.line ?? '-'}줄: ${f.reason}`),
    '',
    '## 검증',
    '',
    ...checkTable(result),
    '',
    ...(last?.remaining.length
      ? ['## 남은 뮤턴트', '', '```', formatMutants(last.remaining), '```', '']
      : []),
  ].join('\n');
}

function parseArgs(argv) {
  const options = { target: null, model: 'sonnet', budget: DEFAULT_RUN_BUDGET_USD, noPush: false };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--model') {
      options.model = argv[++i];
    } else if (argv[i] === '--budget') {
      options.budget = Number(argv[++i]);
    } else if (argv[i] === '--no-push') {
      options.noPush = true;
    } else {
      options.target = argv[i];
    }
  }

  return options;
}

function git(...args) {
  const run = spawnSync('git', args, {
    cwd: CLONE_DIR,
    encoding: 'utf8',
    env: loopEnv(process.env),
  });

  return { ok: run.status === 0, stdout: run.stdout };
}

function main(patterns, { target, model, budget, noPush }) {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const runDir = path.join(RUNS_DIR, `${stamp}-${path.basename(target)}`);
  const logsDir = path.join(runDir, 'logs');
  const profile = path.join(runDir, 'verify.sb');
  const settingsPath = path.join(runDir, 'settings.json');
  const testFiles = testFilesFor(target);
  const spentBefore = sumSpent(RUNS_DIR);
  const env = loopEnv(process.env);
  const tmpRoot = `/private/tmp/claude-${os.userInfo().uid}`;

  fs.mkdirSync(logsDir, { recursive: true });
  // 테스트 코드가 클론 안 원본을 고쳐도 다음 명령의 프로필이 바뀌지 않게 클론 밖 사본을 쓴다.
  fs.copyFileSync(path.join(LOOP_DIR, 'verify.sb'), profile);
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(
      buildSettings(JSON.parse(fs.readFileSync(path.join(LOOP_DIR, 'settings.json'), 'utf8')), {
        cloneDir: CLONE_DIR,
        testFiles,
        tmpRoot,
      }),
      null,
      2
    )
  );

  const result = {
    target,
    outcome: null,
    requestedModel: model,
    models: [],
    baseCommit: git('rev-parse', 'HEAD').stdout.trim(),
    costUsd: 0,
    turns: 0,
    agentCalls: 0,
    agent: null,
    measures: [],
    checks: {},
    final: {},
    published: null,
  };
  const saveResult = () =>
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2));

  /** Seatbelt 안에서 명령 하나를 돌리고 출력은 로그 파일에 남긴다. */
  const sandboxed = (logName, command) => {
    const log = fs.openSync(path.join(logsDir, `${logName}.log`), 'a');
    const run = spawnSync(
      'sandbox-exec',
      [
        '-f',
        profile,
        '-D',
        `WORKDIR=${CLONE_DIR}`,
        '-D',
        `HOME=${HOME}`,
        '-D',
        `CLAUDE_TMP=${tmpRoot}`,
        ...command,
      ],
      { cwd: CLONE_DIR, env, stdio: ['ignore', log, log] }
    );

    fs.closeSync(log);

    return { ok: run.status === 0, detail: run.status === 0 ? '' : `logs/${logName}.log` };
  };

  const measure = (logName) => {
    if (!sandboxed(logName, ['pnpm', 'test:mutation', '--mutate', target]).ok) {
      return null;
    }

    const report = JSON.parse(
      fs.readFileSync(path.join(CLONE_DIR, 'reports/mutation/mutation.json'), 'utf8')
    );
    const summary = summarizeMutants(report, target);

    result.measures.push(summary);
    console.log(
      `[${logName}] 죽음 ${summary.killed} 살아남음 ${summary.survived} 안 닿음 ${summary.noCoverage}`
    );

    return summary;
  };

  const left = () =>
    budgetLeft({
      runBudget: budget,
      totalBudget: TOTAL_BUDGET_USD,
      spentBefore,
      spentThisRun: result.costUsd,
    });

  const callAgent = (prompt, sessionId) => {
    const cap = left();
    const args = [
      '-p',
      prompt,
      '--model',
      model,
      '--setting-sources',
      'local',
      '--settings',
      settingsPath,
      '--tools',
      'Bash,Read,Write,Edit,Glob,Grep',
      '--permission-mode',
      'dontAsk',
      '--max-turns',
      String(MAX_TURNS),
      '--max-budget-usd',
      cap.toFixed(2),
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(STATUS_SCHEMA),
      ...(sessionId ? ['--resume', sessionId] : []),
    ];
    const run = spawnSync('claude', args, {
      cwd: CLONE_DIR,
      env,
      encoding: 'utf8',
      timeout: AGENT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });

    result.agentCalls += 1;
    fs.writeFileSync(path.join(logsDir, `agent-${result.agentCalls}.json`), run.stdout ?? '');

    let output = null;

    try {
      output = JSON.parse(run.stdout);
    } catch {
      // 시간 초과 등으로 응답을 못 받으면 쓴 양을 알 수 없다. 합계 상한이 새지 않게 이 호출의 상한을 다 쓴 것으로 친다.
      result.costUsd += cap;

      return null;
    }

    // total_cost_usd는 --resume으로 이은 세션의 누적값이고 num_turns는 호출별이다
    // (직접 측정 2026-11-06, Haiku: 재개 호출의 modelUsage가 앞 호출 토큰을 포함했다).
    result.costUsd = output.total_cost_usd ?? result.costUsd;
    result.turns += output.num_turns ?? 0;
    result.models = [...new Set([...result.models, ...Object.keys(output.modelUsage ?? {})])];
    result.agent = output.structured_output ?? result.agent;
    saveResult();
    console.log(
      `[agent-${result.agentCalls}] ${output.subtype} ${output.structured_output?.status ?? '-'} 누적 $${result.costUsd.toFixed(2)}`
    );

    return output;
  };

  /** 경로 → 내용 → 테스트 → eslint → 타입 순. 앞이 실패하면 뒤는 돌리지 않는다. */
  const runChecks = () => {
    const changed = parseChangedPaths(git('status', '--porcelain', '-uall').stdout);
    const paths = checkChangedPaths(changed, testFiles);

    result.checks = { 경로: paths };

    if (!paths.ok) {
      return false;
    }

    const testFile = changed[0];
    const baseline = git('show', `HEAD:${testFile}`);
    const baselineText = baseline.ok ? baseline.stdout : '';
    const text = fs.readFileSync(path.join(CLONE_DIR, testFile), 'utf8');

    result.checks.단언 = checkTestContent(text, baselineText, patterns);

    if (!result.checks.단언.ok) {
      return false;
    }

    // 공개 때 어차피 걸리니 재측정에 시간을 쓰기 전에 멈춘다. 더한 줄만 본다.
    const baselineLines = new Set(baselineText.split('\n'));
    const syntax = findForbiddenSyntax(
      text
        .split('\n')
        .filter((line) => !baselineLines.has(line))
        .join('\n')
    );

    result.checks.문법 = { ok: syntax.length === 0, detail: syntax.join(', ') };

    if (!result.checks.문법.ok) {
      return false;
    }

    const steps = [
      ['테스트', 'check-test', [...VITEST, testFile]],
      ['eslint', 'check-eslint', ['pnpm', 'exec', 'eslint', testFile]],
      ['타입', 'check-types', ['pnpm', 'type-check']],
    ];

    for (const [name, logName, command] of steps) {
      result.checks[name] = sandboxed(logName, command);

      if (!result.checks[name].ok) {
        return false;
      }
    }

    return true;
  };

  const runFinal = (testFile) => {
    let passed = 0;

    for (let i = 0; i < REPEAT_RUNS; i += 1) {
      passed += sandboxed('final-repeat', [...VITEST, testFile]).ok ? 1 : 0;
    }

    result.final[`${REPEAT_RUNS}회 반복`] = {
      ok: passed === REPEAT_RUNS,
      detail: `${passed}/${REPEAT_RUNS}`,
    };
    result.final['unit 전체'] = sandboxed('final-unit', VITEST);
  };

  const loop = () => {
    const base = measure('stryker-base');

    if (!base) {
      return 'stryker-failed';
    }

    if (base.remaining.length === 0) {
      return 'no-survivors';
    }

    const template = fs.readFileSync(path.join(LOOP_DIR, 'prompt.md'), 'utf8');
    let prompt = fillPrompt(template, {
      target,
      testFile: testFiles[0],
      mutants: formatMutants(base.remaining),
    });
    let sessionId = null;

    for (let remeasures = 1; ; remeasures += 1) {
      const output = callAgent(prompt, sessionId);
      const stop = agentStop(output);

      if (stop) {
        return stop;
      }

      sessionId = output.session_id;

      // 테스트를 하나도 쓰지 않고 등가로 보고하면 검증할 것이 없다.
      if (
        output.structured_output.status === 'equivalent' &&
        !git('status', '--porcelain', '-uall').stdout.trim()
      ) {
        return 'equivalent';
      }

      if (!runChecks()) {
        return 'check-failed';
      }

      const after = measure(`stryker-${remeasures}`);

      if (!after) {
        return 'stryker-failed';
      }

      const done = afterRemeasure({
        status: output.structured_output.status,
        remaining: after.remaining.length,
        remeasures,
        left: left(),
      });

      if (done) {
        runFinal(result.checks.경로.detail);

        return done;
      }

      prompt = [
        'Stryker를 다시 쟀다. 아직 안 잡힌 뮤턴트는 아래와 같다.',
        '```',
        formatMutants(after.remaining),
        '```',
        '같은 규칙으로 테스트를 보강하고 명령을 모두 통과시킨 뒤 같은 형식으로 출력한다. 더 쓸 테스트가 없으면 `equivalent`로 낸다.',
      ].join('\n');
    }
  };

  /**
   * 샌드박스가 쓰지 못하는 새 클론에 patch만 올려 draft PR을 연다. 에이전트 코드가 돈 클론의 설정과 파일은 쓰지 않고,
   * 인증은 이 함수의 push와 gh만 쓴다. 저장소 훅은 돌리지 않으니 검사는 위에서 끝낸 것을 믿는다.
   */
  const publishDraft = (patch, patchFile) => {
    if (!readyToPublish(result)) {
      return { ok: false, detail: `검증을 다 통과하지 못했다(${result.outcome})` };
    }

    const token = spawnSync('gh', ['auth', 'token'], { env, encoding: 'utf8' });
    const review = reviewPatch(patch, {
      allowed: testFiles,
      secrets: { ...process.env, 'gh auth token': token.status === 0 ? token.stdout.trim() : '' },
    });

    if (!review.ok) {
      return review;
    }

    const testFile = review.detail;
    const subject = commitSubject(target);
    const log = path.join(logsDir, 'publish.log');
    const publishRun = (command, args) => {
      const run = spawnSync(command, args, { cwd: PUBLISH_DIR, env, encoding: 'utf8' });

      fs.appendFileSync(log, `$ ${command} ${args.join(' ')} → ${run.status}\n${run.stderr ?? ''}`);

      return { ok: run.status === 0, stdout: run.stdout ?? '' };
    };
    const publishGit = (...args) => publishRun('git', ['-c', 'core.hooksPath=/dev/null', ...args]);

    fs.rmSync(PUBLISH_DIR, { recursive: true, force: true });
    fs.mkdirSync(PUBLISH_DIR, { recursive: true });

    const prepared =
      publishGit(
        'clone',
        '--quiet',
        '--depth',
        '1',
        '--branch',
        'main',
        `https://github.com/${REPO}.git`,
        '.'
      ).ok &&
      publishGit('apply', '--index', patchFile).ok &&
      publishGit(
        'commit',
        '--quiet',
        '-m',
        subject,
        '-m',
        `테스트 파일 하나만 더한다. 수치와 검증 결과는 PR 본문에 있다.\n\nCo-Authored-By: ${modelLabel(result.models, model)} <noreply@anthropic.com>`
      ).ok;

    if (!prepared) {
      return { ok: false, detail: '새 클론에 커밋을 만들지 못했다(logs/publish.log)' };
    }

    const committed = publishGit('show', '--name-only', '--format=', 'HEAD').stdout.trim();

    if (committed !== testFile) {
      return { ok: false, detail: `커밋의 파일이 다르다: ${committed}` };
    }

    if (noPush) {
      return { ok: false, detail: '--no-push라 새 클론에 커밋까지만 만들었다' };
    }

    const pushed = publishGit(
      '-c',
      'credential.helper=',
      '-c',
      'credential.helper=!gh auth git-credential',
      'push',
      '--quiet',
      'origin',
      refspecFor(target)
    );

    if (!pushed.ok) {
      return { ok: false, detail: 'push가 거부됐다(logs/publish.log)' };
    }

    const bodyFile = path.join(runDir, 'pr-body.md');

    fs.writeFileSync(bodyFile, renderPrBody(result));

    const pr = publishRun('gh', [
      'pr',
      'create',
      '--repo',
      REPO,
      '--draft',
      '--base',
      'main',
      '--head',
      branchFor(target),
      '--title',
      subject,
      '--body-file',
      bodyFile,
    ]);

    if (!pr.ok) {
      return { ok: false, detail: 'push는 됐지만 PR을 열지 못했다(logs/publish.log)' };
    }

    return { ok: true, url: pr.stdout.trim(), detail: testFile };
  };

  try {
    result.outcome = loop();
  } finally {
    result.outcome ??= 'wrapper-error';
    saveResult();

    const changed = parseChangedPaths(git('status', '--porcelain', '-uall').stdout);
    const patchFile = path.join(runDir, 'diff.patch');

    // 새 파일도 diff에 나오도록 표시만 한 뒤, 클론은 다음 실행을 위해 기준 커밋으로 되돌린다.
    git('add', '-N', '--', ...changed);

    const patch = git('diff').stdout;

    fs.writeFileSync(patchFile, patch);
    git('reset', '--quiet');
    git('checkout', '--', '.');
    git('clean', '-fd');
    result.published = publishDraft(patch, patchFile);
    saveResult();
    fs.writeFileSync(path.join(runDir, 'report.md'), renderReport(result));
    console.log(`[끝] ${result.outcome} $${result.costUsd.toFixed(2)} ${runDir}`);
    console.log(`[공개] ${result.published.url ?? result.published.detail}`);
  }
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  const options = parseArgs(process.argv.slice(2));

  if (!isInClone(fileURLToPath(import.meta.url), CLONE_DIR)) {
    throw new Error(`이 스크립트는 ${CLONE_DIR} 안의 사본으로만 실행한다`);
  }

  if (!options.target || !fs.existsSync(path.join(CLONE_DIR, options.target))) {
    throw new Error('사용법: <대상 파일> [--model sonnet] [--budget 3] [--no-push]');
  }

  branchFor(options.target);

  if (git('status', '--porcelain', '-uall').stdout.trim()) {
    throw new Error('클론 작업 트리가 깨끗하지 않다');
  }

  if (sumSpent(RUNS_DIR) >= TOTAL_BUDGET_USD) {
    throw new Error(`합계 상한 $${TOTAL_BUDGET_USD}에 닿았다`);
  }

  const prs = spawnSync(
    'gh',
    [
      'pr',
      'list',
      '--repo',
      REPO,
      '--state',
      'all',
      '--limit',
      '1000',
      '--json',
      'state,headRefName,closedAt',
    ],
    { env: loopEnv(process.env), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );

  if (prs.status !== 0) {
    throw new Error('gh pr list가 실패했다. gh 로그인을 확인한다');
  }

  const gate = decideRunGate(JSON.parse(prs.stdout));

  if (!gate.ok) {
    throw new Error(gate.detail);
  }

  main(await import(TEST_PATTERNS), options);
}
