// deploy-verify 훅·verify-deploy 감시기 회귀 테스트. 실행: node --test .claude/hooks/deploy-verify.test.mjs
// gh·git·시계를 가짜로 주입해 네트워크 없이 판정과 감시 흐름을 확인한다(docs/plans/2026-09-30-
// rule-enforcement-phase3.md "deploy-verify.test.mjs" 행).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import {
  FIRST_RUN_GRACE_MS,
  LAGGING_RUN_SETTLE_MS,
  formatReport,
  needsAttention,
  watchSha,
} from '../scripts/verify-deploy.mjs';
import {
  acquireLock,
  findEvents,
  pushDestinations,
  releaseLock,
  resolveTargets,
} from './deploy-verify.mjs';

const HOOK = path.join(path.dirname(new URL(import.meta.url).pathname), 'deploy-verify.mjs');
const FE_WT = '/w/link-sphere_FE_NEW/.claude/worktrees/x';
const BE_WT = '/w/link-sphere_BE_NEW/.claude/worktrees/y';

let lockRoot;

before(() => {
  lockRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-verify-test-'));
});

after(() => {
  fs.rmSync(lockRoot, { recursive: true, force: true });
});

const kinds = (command, cwd, failed = false) =>
  findEvents({ command, cwd, failed }).map((e) => `${e.kind}:${e.repo}`);

test('findEvents: link-sphere의 push·PR 생성·병합만 고른다', () => {
  assert.deepEqual(kinds('git push -u origin HEAD', FE_WT), ['push:FE']);
  assert.deepEqual(kinds(`cd ${BE_WT} && git push`, '/tmp'), ['push:BE']);
  assert.deepEqual(kinds(`git -C ${FE_WT} push origin main`, '/tmp'), ['push:FE']);
  assert.deepEqual(kinds('gh pr create --title t --body b', FE_WT), ['pr-create:FE']);
  assert.deepEqual(kinds('git push -u origin HEAD && gh pr create --fill', FE_WT), [
    'push:FE',
    'pr-create:FE',
  ]);
  assert.deepEqual(kinds('git push', '/Users/x/plancard'), []);
  assert.deepEqual(kinds('echo "git push && gh pr merge 1"', FE_WT), []);
});

test('findEvents: 새 커밋을 올리지 않는 push는 건너뛴다', () => {
  for (const command of [
    'git push origin --delete old',
    'git push -d origin old',
    'git push --dry-run',
    'git push -n origin x',
    'git push --tags',
    'git push origin --mirror',
  ]) {
    assert.deepEqual(kinds(command, FE_WT), [], command);
  }
});

test('findEvents: gh pr merge의 선택자·-R을 읽고, 실패 이벤트에서는 병합만 본다', () => {
  const [merge] = findEvents({ command: 'gh pr merge 267 --squash --delete-branch', cwd: FE_WT });
  assert.equal(merge.selector, '267');

  const [remote] = findEvents({
    command: 'gh pr merge --squash -R BAECHAN/link-sphere_BE_NEW 12',
    cwd: '/tmp',
  });
  assert.equal(remote.repo, 'BE');
  assert.equal(remote.slug, 'BAECHAN/link-sphere_BE_NEW');
  assert.equal(remote.selector, '12');

  assert.deepEqual(kinds('git push && gh pr merge 5 --squash', FE_WT, true), ['pr-merge:FE']);
  assert.deepEqual(kinds('gh pr create --fill', FE_WT, true), []);
});

function fakeGit(map) {
  return (args) => map[args.join(' ')] ?? null;
}

test('pushDestinations: refspec·HEAD·@{push}로 대상 브랜치를 정한다', () => {
  const git = fakeGit({
    'rev-parse --abbrev-ref HEAD': 'worktree-x',
    'rev-parse --abbrev-ref --symbolic-full-name @{push}': 'origin/worktree-x',
  });
  const dest = (args) => pushDestinations({ args, dir: FE_WT }, git);

  assert.deepEqual(dest(['-u', 'origin', 'HEAD']), [{ remote: 'origin', branch: 'worktree-x' }]);
  assert.deepEqual(dest([]), [{ remote: 'origin', branch: 'worktree-x' }]);
  assert.deepEqual(dest(['origin']), [{ remote: 'origin', branch: 'worktree-x' }]);
  assert.deepEqual(dest(['origin', 'worktree-x:main']), [{ remote: 'origin', branch: 'main' }]);
  assert.deepEqual(dest(['--force-with-lease', 'origin', '+HEAD:refs/heads/main']), [
    { remote: 'origin', branch: 'main' },
  ]);
  assert.deepEqual(dest(['origin', ':old']), []);
  assert.deepEqual(dest(['origin', 'refs/tags/v1.0.0']), []);
  assert.deepEqual(pushDestinations({ args: [], dir: FE_WT }, fakeGit({})), []);
});

test('resolveTargets: push는 원격 추적 ref, 병합은 병합 커밋, 생성은 head SHA', () => {
  const git = fakeGit({
    'rev-parse --abbrev-ref HEAD': 'worktree-x',
    'rev-parse refs/remotes/origin/main': 'aaa111',
    'rev-parse refs/remotes/origin/worktree-x': 'bbb222',
  });
  const push = (args, output = '') =>
    resolveTargets({ kind: 'push', dir: FE_WT, repo: 'FE', args }, { output }, { git });

  assert.deepEqual(
    push(['origin', 'HEAD:main']).map((t) => [t.sha, t.isMain]),
    [['aaa111', true]]
  );
  assert.deepEqual(
    push(['-u', 'origin', 'HEAD']).map((t) => [t.sha, t.isMain]),
    [['bbb222', false]]
  );
  assert.deepEqual(push(['origin', 'HEAD:main'], 'Everything up-to-date\n'), []);

  const gh = (merged) => () =>
    merged
      ? { number: 7, state: 'MERGED', mergeCommit: { oid: 'ccc333' }, baseRefName: 'main' }
      : { number: 7, state: 'OPEN', mergeCommit: null, baseRefName: 'main' };
  const merge = (merged) =>
    resolveTargets(
      { kind: 'pr-merge', dir: FE_WT, repo: 'FE', selector: '7' },
      {},
      { gh: gh(merged) }
    );

  assert.deepEqual(
    merge(true).map((t) => [t.sha, t.isMain, t.source]),
    [['ccc333', true, 'PR #7 병합 → main']]
  );
  assert.deepEqual(merge(false), []);

  const created = resolveTargets(
    { kind: 'pr-create', dir: FE_WT, repo: 'FE' },
    {},
    { gh: () => ({ number: 8, state: 'OPEN', headRefOid: 'ddd444', baseRefName: 'main' }) }
  );
  assert.deepEqual(
    created.map((t) => [t.sha, t.isMain]),
    [['ddd444', false]]
  );

  const broken = resolveTargets(
    { kind: 'pr-merge', dir: FE_WT, repo: 'FE' },
    {},
    {
      gh: () => {
        throw new Error('network');
      },
    }
  );
  assert.deepEqual(broken, []);
});

/**
 * 호출할 때마다 다음 응답을 내는 가짜 gh. `run list --commit`·`--workflow` 조회·`api .../runs/<id>/jobs`를
 * 나눠 받는다. jobs는 run id별 응답 목록이고 호출마다 다음 것을 낸다. 없으면 실패해 run 값으로 판정된다.
 */
function fakeGh({ commitRuns, workflowRuns = {}, jobs = {} }) {
  let call = 0;
  const jobCalls = {};

  return (args) => {
    if (args[0] === 'api') {
      const id = Number(args[1].match(/runs\/(\d+)\/jobs$/)[1]);
      const seq = jobs[id];

      if (!seq) {
        throw new Error('jobs 없음');
      }

      jobCalls[id] = (jobCalls[id] ?? 0) + 1;

      return { jobs: seq[Math.min(jobCalls[id] - 1, seq.length - 1)] };
    }

    if (args.includes('--workflow')) {
      return workflowRuns[args[args.indexOf('--workflow') + 1]] ?? [];
    }

    const next = commitRuns[Math.min(call, commitRuns.length - 1)];
    call += 1;

    if (next instanceof Error) {
      throw next;
    }

    return next;
  };
}

function fakeClock() {
  let t = 0;

  return { now: () => t, sleep: async (ms) => (t += ms) };
}

const run = (name, status, conclusion, id = 1) => ({
  databaseId: id,
  workflowName: name,
  status,
  conclusion,
  event: 'push',
  headSha: 'sha1',
  url: `https://example/run/${id}`,
});

const watch = (gh, extra = {}) =>
  watchSha(
    { sha: 'sha1', repo: 'FE', isMain: false, cwd: FE_WT, ...extra },
    { gh, clock: fakeClock() }
  );

test('watchSha: 늦게 나타난 run이 전부 성공하면 확인 불필요', async () => {
  const result = await watch(
    fakeGh({
      commitRuns: [[], [run('CI', 'in_progress', '')], [run('CI', 'completed', 'success')]],
    })
  );

  assert.equal(needsAttention(result), false);
  assert.equal(result.runs.length, 1);
});

test('watchSha: failure가 있으면 깨울 대상이고 보고문에 로그 명령이 있다', async () => {
  const result = await watch(
    fakeGh({
      commitRuns: [[run('CI', 'completed', 'failure', 42), run('Doc', 'completed', 'success', 43)]],
    })
  );
  const report = formatReport(result, { repo: 'FE', source: 'x push' });

  assert.equal(needsAttention(result), true);
  assert.match(report, /gh run view 42 --log-failed/);
  assert.match(report, /정정/);
});

test('watchSha: cancelled·skipped만 있으면 중립이다', async () => {
  const result = await watch(
    fakeGh({
      commitRuns: [[run('CI', 'completed', 'cancelled', 1), run('X', 'completed', 'skipped', 2)]],
    })
  );

  assert.equal(needsAttention(result), false);
});

test('watchSha: 첫 run 대기 시간 동안 아무것도 없으면 워크플로 대상이 아닌 커밋으로 끝낸다', async () => {
  const clock = fakeClock();
  const result = await watchSha(
    { sha: 'sha1', repo: 'FE', isMain: false, cwd: FE_WT },
    { gh: fakeGh({ commitRuns: [[]] }), clock }
  );

  assert.equal(needsAttention(result), false);
  assert.ok(clock.now() >= FIRST_RUN_GRACE_MS);
  assert.match(formatReport(result, { repo: 'FE', source: 'x' }), /워크플로 없음/);
});

test('watchSha: gh가 계속 실패하면 첫 run 대기 시간 뒤 error로 끝낸다(깨우지 않음)', async () => {
  const result = await watch(fakeGh({ commitRuns: [new Error('auth')] }));

  assert.equal(result.error, 'auth');
  assert.equal(needsAttention(result), false);
});

test('watchSha: 시한까지 안 끝나면 시한 초과로 깨우고 watch 명령을 준다', async () => {
  const result = await watch(fakeGh({ commitRuns: [[run('CI', 'in_progress', '', 9)]] }), {
    deadlineMs: 60_000,
  });
  const report = formatReport(result, { repo: 'FE', source: 'x', deadlineMs: 60_000 });

  assert.equal(result.timedOut, true);
  assert.equal(needsAttention(result), true);
  assert.match(report, /gh run watch 9 --exit-status/);
});

const job = (name, status, conclusion, steps = [], id = 100) => ({
  id,
  name,
  status,
  conclusion,
  steps,
});

test('watchSha: run 목록이 진행 중으로 남아도 job이 다 끝나면 시한 초과로 깨우지 않는다', async () => {
  // 2026-10-27 Storybook run 40511990513 — job은 1분 만에 끝났는데 run은 20분 뒤에야 completed가 됐다.
  const clock = fakeClock();
  const result = await watchSha(
    { sha: 'sha1', repo: 'FE', isMain: false, cwd: FE_WT, deadlineMs: 10 * 60_000 },
    {
      gh: fakeGh({
        commitRuns: [[run('Storybook Deploy (S3 + CloudFront)', 'in_progress', '', 7)]],
        jobs: { 7: [[job('deploy', 'completed', 'success')]] },
      }),
      clock,
    }
  );

  assert.equal(result.timedOut, false);
  assert.equal(needsAttention(result), false);
  assert.ok(clock.now() >= LAGGING_RUN_SETTLE_MS);
});

test('watchSha: run 목록이 먼저 성공으로 보여도 job이 끝날 때까지 보고, job 실패를 알린다', async () => {
  // 2026-10-27 #432 배포 run 40516883699 — deploy job이 queued인데 run 목록은 completed success였다.
  const result = await watch(
    fakeGh({
      commitRuns: [[run('Frontend Deploy (S3 + CloudFront)', 'completed', 'success', 8)]],
      jobs: {
        8: [
          [job('deploy', 'queued', null)],
          [job('deploy', 'in_progress', null)],
          [
            job('deploy', 'completed', 'failure', [
              { name: 'Build', status: 'completed', conclusion: 'success' },
              { name: '배포 반영 검증', status: 'completed', conclusion: 'failure' },
            ]),
          ],
        ],
      },
    })
  );
  const report = formatReport(result, { repo: 'FE', source: 'PR #1 병합 → main' });

  assert.equal(needsAttention(result), true);
  assert.match(report, /실패한 단계: deploy › 배포 반영 검증/);
  assert.match(report, /gh run view 8 --log-failed/);
  assert.match(report, /curl .*linksphere\.click\/version\.json/);
});

test('watchSha: 사이트를 받지 않는 단계의 실패에는 사이트 확인 안내를 붙이지 않는다', async () => {
  const result = await watch(
    fakeGh({
      commitRuns: [[run('CI', 'completed', 'failure', 9)]],
      jobs: {
        9: [
          [
            job('check', 'completed', 'failure', [
              {
                name: 'Type check, lint & format check',
                status: 'completed',
                conclusion: 'failure',
              },
            ]),
          ],
        ],
      },
    })
  );
  const report = formatReport(result, { repo: 'FE', source: 'x push' });

  assert.match(report, /실패한 단계: check › Type check, lint & format check/);
  assert.doesNotMatch(report, /linksphere\.click/);
});

test('watchSha: main이면 이 커밋이 안 돌린 배포 워크플로의 실패 잔존을 찾는다', async () => {
  const stale = await watch(
    fakeGh({
      commitRuns: [[run('Doc Drift Check', 'completed', 'success')]],
      workflowRuns: {
        'Frontend Deploy (S3 + CloudFront)': [
          { ...run('', 'completed', 'cancelled', 5), headSha: 'new1' },
          { ...run('', 'completed', 'failure', 4), headSha: 'old0' },
        ],
        'Storybook Deploy (GitHub Pages)': [run('', 'completed', 'success', 3)],
      },
    }),
    { isMain: true }
  );
  const report = formatReport(stale, { repo: 'FE', source: 'main push' });

  assert.deepEqual(
    stale.stale.map((r) => r.workflowName),
    ['Frontend Deploy (S3 + CloudFront)']
  );
  assert.match(report, /gh workflow run "Frontend Deploy \(S3 \+ CloudFront\)" --ref main/);

  const rerunning = await watch(
    fakeGh({
      commitRuns: [[run('Doc Drift Check', 'completed', 'success')]],
      workflowRuns: {
        'Frontend Deploy (S3 + CloudFront)': [
          { ...run('', 'in_progress', '', 6), event: 'workflow_dispatch' },
          run('', 'completed', 'failure', 4),
        ],
      },
    }),
    { isMain: true }
  );
  assert.equal(rerunning.stale.length, 0);

  const ranHere = await watch(
    fakeGh({
      commitRuns: [[run('Frontend Deploy (S3 + CloudFront)', 'completed', 'success')]],
      workflowRuns: {
        'Frontend Deploy (S3 + CloudFront)': [run('', 'completed', 'failure', 4)],
      },
    }),
    { isMain: true }
  );
  assert.equal(ranHere.stale.length, 0);
});

test('acquireLock: 같은 SHA는 한 번만 잡히고, 풀거나 오래되면 다시 잡힌다', () => {
  const dir = path.join(lockRoot, 'locks');
  const first = acquireLock('abc', { dir });

  assert.ok(first);
  assert.equal(acquireLock('abc', { dir }), null);
  assert.ok(acquireLock('abc', { dir, staleMs: -1 }));

  releaseLock(first);
  assert.ok(acquireLock('abc', { dir }));
});

test('훅 진입점: 대상이 아니거나 입력이 깨지면 바로 exit 0', () => {
  const runHook = (input) =>
    spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8', timeout: 10_000 });

  assert.equal(runHook('not json').status, 0);
  assert.equal(
    runHook(JSON.stringify({ tool_input: { command: 'ls -la' }, cwd: FE_WT })).status,
    0
  );
  assert.equal(
    runHook(JSON.stringify({ tool_input: { command: 'git push' }, cwd: '/Users/x/plancard' }))
      .status,
    0
  );
});
