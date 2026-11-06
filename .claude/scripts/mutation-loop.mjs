// 뮤테이션 테스트 자동 보강 루프(L1: 보고만). AI 루프 준비 Phase 2(docs/plans/2026-11-06-mutation-loop.md).
// 파일 하나의 빈틈을 Stryker로 재고, claude -p에게 테스트를 쓰게 한 뒤, 검증과 재측정을 거쳐 클론 밖에 보고서를
// 남긴다. PR을 열거나 push하지 않는다.
//
// - 별도 클론(~/project/loop-lab/fe)에 있는 이 파일로만 돈다. 다른 곳에서 실행하면 거부한다.
// - 에이전트가 쓴 코드를 실행하는 명령은 전부 Seatbelt(.claude/loops/mutation/verify.sb) 안에서 돌린다.
// - 로컬 전용이다 — CI나 package.json에 등록하지 않는다.
//
// 사용법(준비 절차는 docs/TESTING.md "자동 보강 루프"):
//   node ~/project/loop-lab/fe/.claude/scripts/mutation-loop.mjs <대상 파일> [--model sonnet] [--budget 3]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = os.homedir();
const CLONE_DIR = path.join(HOME, 'project/loop-lab/fe');
const RUNS_DIR = path.join(HOME, 'project/loop-lab/runs');
const LOOP_DIR = path.join(CLONE_DIR, '.claude/loops/mutation');
// 단언·건너뛰기 패턴의 정본. claude-base는 원격이 없어 CI에 없으므로 main()에서만 불러온다.
const TEST_PATTERNS = path.join(HOME, 'project/claude-base/lib/test-patterns.mjs');

// 상한은 계획에서 사용자가 고른 값이다. 달러는 청구액이 아니라 사용량을 목록가로 환산한 값이다(구독 로그인).
const TOTAL_BUDGET_USD = 15;
const DEFAULT_RUN_BUDGET_USD = 3;
const MAX_TURNS = 30;
const MAX_REMEASURES = 2;
const REPEAT_RUNS = 10;
const AGENT_TIMEOUT_MS = 30 * 60 * 1000;

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

/** 저장소의 settings.json에 이 실행의 쓰기 허용과 쓰기 금지를 덧붙인다. */
export function buildSettings(base, { cloneDir, testFiles }) {
  return {
    ...base,
    sandbox: {
      ...base.sandbox,
      filesystem: {
        ...base.sandbox.filesystem,
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

export function renderReport(result) {
  const row = (label, m) =>
    `| ${label} | ${m.killed} | ${m.survived} | ${m.noCoverage} | ${m.score ?? '-'}% |`;
  const checks = Object.entries({ ...result.checks, ...result.final }).map(
    ([name, check]) => `| ${name} | ${check.ok ? '통과' : '실패'} | ${check.detail ?? ''} |`
  );
  const agent = result.agent;
  const last = result.measures.at(-1);

  return [
    `# ${result.target}: ${result.outcome}`,
    '',
    `- 모델: ${result.models.join(', ') || '-'}`,
    `- 비용(목록가 환산): $${result.costUsd.toFixed(2)} / 턴 ${result.turns} / 호출 ${result.agentCalls}`,
    `- 기준 커밋: ${result.baseCommit}`,
    '',
    '## 뮤턴트',
    '',
    '| 측정 | 죽음 | 살아남음 | 안 닿음 | 점수 |',
    '| --- | --- | --- | --- | --- |',
    ...result.measures.map((m, i) => row(i === 0 ? '기준값' : `재측정 ${i}`, m)),
    '',
    '## 에이전트 보고',
    '',
    `- 상태: ${agent?.status ?? '-'}`,
    `- 요약: ${agent?.summary ?? '-'}`,
    ...(agent?.findings ?? []).map((f) => `- ${f.line ?? '-'}줄: ${f.reason}`),
    '',
    '## 검증',
    '',
    '| 항목 | 결과 | 비고 |',
    '| --- | --- | --- |',
    ...checks,
    '',
    ...(last?.remaining.length
      ? ['## 남은 뮤턴트', '', '```', formatMutants(last.remaining), '```', '']
      : []),
  ].join('\n');
}

function parseArgs(argv) {
  const options = { target: null, model: 'sonnet', budget: DEFAULT_RUN_BUDGET_USD };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--model') {
      options.model = argv[++i];
    } else if (argv[i] === '--budget') {
      options.budget = Number(argv[++i]);
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

function main(patterns, { target, model, budget }) {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const runDir = path.join(RUNS_DIR, `${stamp}-${path.basename(target)}`);
  const logsDir = path.join(runDir, 'logs');
  const profile = path.join(runDir, 'verify.sb');
  const settingsPath = path.join(runDir, 'settings.json');
  const testFiles = testFilesFor(target);
  const spentBefore = sumSpent(RUNS_DIR);
  const env = loopEnv(process.env);

  fs.mkdirSync(logsDir, { recursive: true });
  // 테스트 코드가 클론 안 원본을 고쳐도 다음 명령의 프로필이 바뀌지 않게 클론 밖 사본을 쓴다.
  fs.copyFileSync(path.join(LOOP_DIR, 'verify.sb'), profile);
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(
      buildSettings(JSON.parse(fs.readFileSync(path.join(LOOP_DIR, 'settings.json'), 'utf8')), {
        cloneDir: CLONE_DIR,
        testFiles,
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
  };
  const saveResult = () =>
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2));

  /** Seatbelt 안에서 명령 하나를 돌리고 출력은 로그 파일에 남긴다. */
  const sandboxed = (logName, command) => {
    const log = fs.openSync(path.join(logsDir, `${logName}.log`), 'a');
    const run = spawnSync(
      'sandbox-exec',
      ['-f', profile, '-D', `WORKDIR=${CLONE_DIR}`, '-D', `HOME=${HOME}`, ...command],
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

    result.checks.단언 = checkTestContent(
      fs.readFileSync(path.join(CLONE_DIR, testFile), 'utf8'),
      baseline.ok ? baseline.stdout : '',
      patterns
    );

    if (!result.checks.단언.ok) {
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

  try {
    result.outcome = loop();
  } finally {
    result.outcome ??= 'wrapper-error';
    saveResult();

    const changed = parseChangedPaths(git('status', '--porcelain', '-uall').stdout);

    // 새 파일도 diff에 나오도록 표시만 한 뒤, 클론은 다음 실행을 위해 기준 커밋으로 되돌린다.
    git('add', '-N', '--', ...changed);
    fs.writeFileSync(path.join(runDir, 'diff.patch'), git('diff').stdout);
    fs.writeFileSync(path.join(runDir, 'report.md'), renderReport(result));
    git('reset', '--quiet');
    git('checkout', '--', '.');
    git('clean', '-fd');
    console.log(`[끝] ${result.outcome} $${result.costUsd.toFixed(2)} ${runDir}`);
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
    throw new Error('사용법: <대상 파일> [--model sonnet] [--budget 3]');
  }

  if (git('status', '--porcelain', '-uall').stdout.trim()) {
    throw new Error('클론 작업 트리가 깨끗하지 않다');
  }

  if (sumSpent(RUNS_DIR) >= TOTAL_BUDGET_USD) {
    throw new Error(`합계 상한 $${TOTAL_BUDGET_USD}에 닿았다`);
  }

  main(await import(TEST_PATTERNS), options);
}
