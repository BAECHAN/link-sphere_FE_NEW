// 커밋(SHA) 하나의 GitHub Actions 워크플로 결과를 끝까지 지켜보고 실패를 알려 주는 감시기. 사용자 설정의
// PostToolUse 훅(.claude/hooks/deploy-verify.mjs)이 push·PR 생성·병합 뒤 watchSha를 백그라운드로 돌리고,
// 사람이나 Claude가 직접 돌릴 수도 있다:
//   node .claude/scripts/verify-deploy.mjs <sha> [--dir <레포 경로>] [--main]   (실패·시한 초과면 exit 1)
//
// 배경: .claude/CLAUDE.md "main에 push한 뒤 워크플로우 결과를 확인하지 않고 '배포됨'이라 보고" 금지 규칙.
// 2026-09-06 docs만 고친 후속 커밋이 deploy.yml 경로 필터에 안 걸려, 앞선 배포 실패가 그대로 남은 채
// 조용히 미배포된 사고가 있었다(docs/CI-CHECK-GATE.md §9.3). 계획: docs/plans/2026-09-30-rule-enforcement-
// phase3.md.
import { execFileSync } from 'child_process';
import path from 'path';

import { repoOf } from '../lib/shell-parse.mjs';

export const POLL_MS = 15_000;
// push 직후 run이 GitHub에 등록되기까지 기다리는 시간. 넘도록 하나도 없으면 "이 커밋은 워크플로 대상 아님"으로 본다.
export const FIRST_RUN_GRACE_MS = 120_000;
// 전부 끝난 뒤에도 이만큼 새 run이 안 붙으면 종료한다(같은 push 이벤트의 run은 거의 동시에 등록된다).
export const SETTLE_MS = 30_000;
export const DEFAULT_DEADLINE_MS = 25 * 60_000;

// 세션을 깨울 결론. cancelled는 FE·BE ci.yml의 cancel-in-progress(연속 push) 때문에 흔해서 중립으로 둔다.
export const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure']);

// 경로 필터가 있어 "이 커밋은 다시 돌리지 않았는데 main의 직전 실패가 그대로 남은" 상태가 생길 수 있는
// 배포 워크플로. 이름이 바뀌면 여기도 고친다(FE·BE .github/workflows/*.yml의 name).
export const DEPLOY_WORKFLOWS = {
  FE: ['Frontend Deploy (S3 + CloudFront)', 'Storybook Deploy (S3 + CloudFront)'],
  BE: ['Deploy to AWS Lambda (SnapStart)'],
};

const RUN_FIELDS = 'databaseId,workflowName,status,conclusion,event,headSha,url';
// 훅 프로세스 PATH에 gh가 없을 때를 대비한 후보(2026-09-30 스파이크에서는 PATH에 있었다).
const GH_CANDIDATES = ['gh', '/opt/homebrew/bin/gh', '/usr/local/bin/gh'];

let ghBin;

function findGh() {
  if (ghBin !== undefined) {
    return ghBin;
  }

  ghBin = null;

  for (const candidate of GH_CANDIDATES) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore', timeout: 5000 });
      ghBin = candidate;
      break;
    } catch {
      // 다음 후보
    }
  }

  return ghBin;
}

/** 실제 gh 실행기. JSON을 파싱해 돌려주고, 실패하면 throw. */
export function realGh(args, { cwd, repoSlug } = {}) {
  const bin = findGh();

  if (!bin) {
    throw new Error('gh를 찾지 못했다');
  }

  const out = execFileSync(bin, [...args, ...(repoSlug ? ['-R', repoSlug] : [])], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });

  return JSON.parse(out);
}

export const realClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function runKey(runs) {
  return runs
    .map((r) => `${r.databaseId}:${r.status}:${r.conclusion}`)
    .sort()
    .join('|');
}

/**
 * main에서 이 커밋이 돌리지 않은 배포 워크플로의 최신 run이 실패로 남아 있는지 찾는다.
 * push·workflow_dispatch만 보고, 취소·건너뜀은 넘긴다. 최신 run이 진행 중이면 실패로 보지 않는다.
 */
export function findStaleDeploys({ repo, runs, cwd, repoSlug }, gh = realGh) {
  const stale = [];

  for (const name of DEPLOY_WORKFLOWS[repo] ?? []) {
    if (runs.some((r) => r.workflowName === name)) {
      continue;
    }

    let history;

    try {
      history = gh(
        [
          'run',
          'list',
          '--workflow',
          name,
          '--branch',
          'main',
          '--limit',
          '10',
          '--json',
          RUN_FIELDS,
        ],
        { cwd, repoSlug }
      );
    } catch {
      continue;
    }

    const latest = history.find(
      (r) =>
        ['push', 'workflow_dispatch'].includes(r.event) &&
        !['cancelled', 'skipped'].includes(r.conclusion)
    );

    if (latest && latest.status === 'completed' && FAILED_CONCLUSIONS.has(latest.conclusion)) {
      stale.push({ ...latest, workflowName: name });
    }
  }

  return stale;
}

/**
 * SHA의 run이 전부 끝날 때까지(또는 시한까지) 지켜본다. 첫 run이 FIRST_RUN_GRACE_MS 안에 안 나타나면
 * 워크플로 대상이 아닌 커밋으로 보고 끝낸다. 그동안 gh 호출이 한 번도 성공하지 못하면 error를 채워 돌려준다.
 */
export async function watchSha(
  { sha, repo, isMain, cwd, repoSlug, deadlineMs = DEFAULT_DEADLINE_MS },
  { gh = realGh, clock = realClock } = {}
) {
  const start = clock.now();
  let runs = [];
  let fetched = false;
  let lastError = null;
  let lastKey = null;
  let lastChangeAt = start;
  let timedOut = false;

  for (;;) {
    try {
      runs = gh(['run', 'list', '--commit', sha, '--limit', '50', '--json', RUN_FIELDS], {
        cwd,
        repoSlug,
      });
      fetched = true;
    } catch (error) {
      lastError = error.message;
    }

    const now = clock.now();
    const key = runKey(runs);

    if (key !== lastKey) {
      lastKey = key;
      lastChangeAt = now;
    }

    const allDone = runs.length > 0 && runs.every((r) => r.status === 'completed');

    if (allDone && now - lastChangeAt >= SETTLE_MS) {
      break;
    }

    // run이 없거나 gh 조회가 계속 실패하면 첫 run 대기 시간까지만 본다.
    if (runs.length === 0 && now - start >= FIRST_RUN_GRACE_MS) {
      break;
    }

    if (now - start >= deadlineMs) {
      timedOut = true;
      break;
    }

    await clock.sleep(POLL_MS);
  }

  if (!fetched) {
    return { sha, runs: [], failed: [], pending: [], stale: [], timedOut, error: lastError };
  }

  const failed = runs.filter(
    (r) => r.status === 'completed' && FAILED_CONCLUSIONS.has(r.conclusion)
  );
  const pending = runs.filter((r) => r.status !== 'completed');
  const stale = isMain && !timedOut ? findStaleDeploys({ repo, runs, cwd, repoSlug }, gh) : [];

  return { sha, runs, failed, pending, stale, timedOut, error: null };
}

export function needsAttention(result) {
  return result.failed.length > 0 || result.stale.length > 0 || result.timedOut;
}

/** 사람·Claude가 읽을 보고문. 실패·시한 초과면 다음에 할 명령까지 적는다. */
export function formatReport(result, { repo, source, deadlineMs = DEFAULT_DEADLINE_MS }) {
  const head = `[deploy-verify] link-sphere ${repo} ${result.sha.slice(0, 7)} (${source})`;

  if (result.error) {
    return `${head}: gh로 워크플로를 조회하지 못했다(${result.error}).`;
  }

  if (!needsAttention(result)) {
    const summary = result.runs.length
      ? result.runs.map((r) => `${r.workflowName} ${r.conclusion}`).join(', ')
      : '이 커밋이 돌린 워크플로 없음';

    return `${head}: 이상 없음 — ${summary}`;
  }

  const lines = [`${head}의 워크플로에 확인이 필요한 결과가 있다.`];

  for (const r of result.failed) {
    lines.push(`- ${r.workflowName}: ${r.conclusion} — ${r.url}`);
    lines.push(`  원인 확인: gh run view ${r.databaseId} --log-failed`);
  }

  for (const r of result.stale) {
    lines.push(
      `- ${r.workflowName}: 이 커밋은 경로 필터에 안 걸려 다시 돌리지 않았고, main의 마지막 run(${r.headSha.slice(0, 7)})이 ${r.conclusion}로 남아 있다 — ${r.url}`
    );
    lines.push(`  다시 배포: gh workflow run "${r.workflowName}" --ref main`);
  }

  if (result.timedOut) {
    lines.push(`- ${Math.round(deadlineMs / 60_000)}분 안에 끝나지 않은 run:`);

    for (const r of result.pending) {
      lines.push(`  ${r.workflowName}(${r.status}) — gh run watch ${r.databaseId} --exit-status`);
    }
  }

  lines.push(
    '이미 "배포됨"·"통과"라고 보고했다면 정정하고, 원인과 조치를 사용자에게 함께 보고한다(.claude/CLAUDE.md "main에 push한 뒤" 규칙).'
  );

  return lines.join('\n');
}

function parseCliArgs(argv) {
  const options = { sha: null, dir: process.cwd(), isMain: false };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') {
      options.dir = path.resolve(argv[++i]);
    } else if (argv[i] === '--main') {
      options.isMain = true;
    } else {
      options.sha = argv[i];
    }
  }

  return options;
}

/** 짧은 SHA·ref를 전체 SHA로 펼친다 — `gh run list --commit`은 전체 SHA로만 걸러진다(2026-09-30 실측). */
function fullSha(ref, dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--verify', `${ref}^{commit}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

async function cli() {
  const { sha: ref, dir, isMain } = parseCliArgs(process.argv.slice(2));
  const repo = repoOf(dir)?.repo;
  const sha = ref ? fullSha(ref, dir) : null;

  if (!sha || !repo) {
    console.error(
      '사용법: node .claude/scripts/verify-deploy.mjs <sha> [--dir <link-sphere 레포 경로>] [--main]'
    );
    process.exit(2);
  }

  const result = await watchSha({ sha, repo, isMain, cwd: dir });
  console.log(formatReport(result, { repo, source: isMain ? 'main' : '브랜치' }));
  process.exit(needsAttention(result) || result.error ? 1 : 0);
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isEntrypoint) {
  cli();
}
