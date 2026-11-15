// CI e2e의 첫 시도(run attempt 1) 흔들림을 센다(docs/E2E-FLAKY.md §4·§10). ci.yml run마다 첫 시도의 e2e job 로그를
// 받아 "Run e2e tests"와 "바뀐 e2e 스펙 반복 실행" 단계의 Playwright 요약 줄(N flaky·N failed·N passed)을 나눠 센다.
//
//   node scripts/e2e-flaky-measure/measure.mjs --since 2026-11-01T07:27:00Z [--until <ISO>] [--cache <폴더>]
//
// gh CLI 로그인이 필요하다. run 하나에 API를 두 번(첫 시도 job 목록, job 로그) 부른다. 받은 결과는 --cache 폴더에
// run마다 JSON으로 남겨 다시 돌릴 때 건너뛴다(기본은 OS 임시 폴더). 첫 시도 로그는 gh run view --log-failed가 아니라
// API로 받는다 - 재시도된 run에서 다른 시도의 로그를 줄 수 있다(§9.3).

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, promisify } from 'node:util';

const REPO = 'BAECHAN/link-sphere_FE_NEW';
const CONCURRENCY = 6;
const MAIN_STEP = 'Run e2e tests';
const REPEAT_STEP = '바뀐 e2e 스펙 반복 실행';
const SUMMARY_LINE = /^\s+(\d+) (passed|failed|flaky|skipped|did not run|interrupted)\b/;
const FINISHED = new Set(['success', 'failure']);

const run = promisify(execFile);
const { values: args } = parseArgs({
  options: {
    since: { type: 'string' },
    until: { type: 'string' },
    cache: { type: 'string', default: path.join(os.tmpdir(), 'e2e-flaky-measure') },
  },
});

if (!args.since) {
  console.error('--since <ISO 시각>이 필요하다(예: 2026-11-01T07:27:00Z)');
  process.exit(1);
}

async function gh(ghArgs) {
  const { stdout } = await run('gh', ghArgs, { maxBuffer: 200 * 1024 * 1024 });

  return stdout;
}

function stripLine(line) {
  return line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, '').replace(/\x1b\[[0-9;]*m/g, '');
}

// 로그를 단계 시작 표식(##[group]Run <명령>)으로 나눠 두 단계의 요약 줄과 흔들린·실패한 테스트 이름을 모은다
function parseLog(text) {
  const result = { main: { counts: {}, tests: [] }, repeat: { counts: {}, tests: [] } };
  let section = null;
  let listing = false;

  for (const raw of text.split('\n')) {
    const line = stripLine(raw);

    if (line.startsWith('##[group]Run ')) {
      const command = line.slice('##[group]Run '.length);

      if (
        command.startsWith('pnpm test:e2e') &&
        section === null &&
        Object.keys(result.main.counts).length === 0
      ) {
        section = 'main';
      } else if (command.startsWith('mapfile -t specs')) {
        section = 'repeat';
      } else {
        section = null;
      }

      listing = false;
      continue;
    }

    if (!section) {
      continue;
    }

    const summary = line.match(SUMMARY_LINE);

    if (summary) {
      result[section].counts[summary[2]] = Number(summary[1]);
      listing = summary[2] === 'flaky' || summary[2] === 'failed';
      continue;
    }

    if (listing && /^\s+\[/.test(line)) {
      result[section].tests.push(line.trim());
    }
  }

  return result;
}

function seconds(step) {
  if (!step?.started_at || !step?.completed_at) {
    return null;
  }

  return (Date.parse(step.completed_at) - Date.parse(step.started_at)) / 1000;
}

async function measureRun(listed) {
  const file = path.join(args.cache, `${listed.databaseId}.json`);

  if (existsSync(file)) {
    return JSON.parse(await readFile(file, 'utf8'));
  }

  const jobs = JSON.parse(
    await gh(['api', `repos/${REPO}/actions/runs/${listed.databaseId}/attempts/1/jobs?per_page=50`])
  );
  const e2e = jobs.jobs.find((job) => job.name === 'e2e');
  const row = {
    id: listed.databaseId,
    createdAt: listed.createdAt,
    branch: listed.headBranch,
    title: listed.displayTitle,
  };

  if (e2e) {
    const mainStep = e2e.steps.find((step) => step.name === MAIN_STEP);
    const repeatStep = e2e.steps.find((step) => step.name === REPEAT_STEP);
    Object.assign(row, {
      mainConclusion: mainStep?.conclusion ?? null,
      repeatConclusion: repeatStep?.conclusion ?? null,
      repeatSec: seconds(repeatStep),
      jobSec: seconds(e2e),
    });

    if (FINISHED.has(row.mainConclusion)) {
      Object.assign(row, parseLog(await gh(['api', `repos/${REPO}/actions/jobs/${e2e.id}/logs`])));
    }
  }

  await writeFile(file, JSON.stringify(row));

  return row;
}

async function measureAll(listedRuns) {
  const queue = [...listedRuns];
  const rows = [];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      rows.push(await measureRun(queue.shift()));
    }
  });
  await Promise.all(workers);

  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function report(rows) {
  const finished = rows.filter((row) => FINISHED.has(row.mainConclusion));
  const failed = finished.filter((row) => (row.main.counts.failed ?? 0) > 0);
  const flaky = finished.filter((row) => (row.main.counts.flaky ?? 0) > 0 && !failed.includes(row));
  const repeated = rows.filter((row) => Object.keys(row.repeat?.counts ?? {}).length > 0);
  const repeatFailed = rows.filter((row) => row.repeatConclusion === 'failure');
  const repeatSecs = repeated.map((row) => row.repeatSec).sort((a, b) => a - b);
  const excluded = Object.groupBy(
    rows.filter((row) => !finished.includes(row)),
    (row) => row.mainConclusion ?? 'e2e 없음'
  );

  console.log(`ci.yml run ${rows.length}개 중 첫 시도 e2e가 끝까지 돈 것 ${finished.length}개`);
  console.log(
    `  뺀 것: ${Object.entries(excluded)
      .map(([key, list]) => `${key} ${list.length}`)
      .join(', ')}`
  );
  console.log(`재시도로만 통과(flaky) ${flaky.length}, 재시도도 실패 ${failed.length}`);

  for (const row of [...flaky, ...failed]) {
    console.log(`  ${row.createdAt} run ${row.id} ${row.branch}`);

    for (const test of row.main.tests) {
      console.log(`    ${test}`);
    }
  }

  console.log(`반복 단계가 스펙을 돈 run ${repeated.length}개, 실패 ${repeatFailed.length}`);

  if (repeatSecs.length > 0) {
    console.log(
      `  반복 단계 시간(초) 중앙값 ${percentile(repeatSecs, 0.5)}, 상위 10% ${percentile(repeatSecs, 0.9)}, 최대 ${repeatSecs.at(-1)}`
    );
  }

  for (const row of repeatFailed) {
    console.log(`  ${row.createdAt} run ${row.id} ${row.branch}: ${row.repeat?.tests.join(' / ')}`);
  }
}

await mkdir(args.cache, { recursive: true });

const listed = JSON.parse(
  await gh([
    'run',
    'list',
    '-R',
    REPO,
    '--workflow',
    'ci.yml',
    '--limit',
    '1000',
    '--created',
    `>=${args.since.slice(0, 10)}`,
    '--json',
    'databaseId,createdAt,headBranch,displayTitle',
  ])
).filter((row) => row.createdAt >= args.since && (!args.until || row.createdAt < args.until));

report(await measureAll(listed));
