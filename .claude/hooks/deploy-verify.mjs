// PostToolUse·PostToolUseFailure(Bash) 훅 — link-sphere FE·BE에서 git push·gh pr create·gh pr merge가 끝나면
// 그 커밋(SHA)의 GitHub Actions 워크플로를 백그라운드로 지켜보다, 실패·시한 초과면 세션을 깨운다.
// 사용자 설정에 `asyncRewake: true`로 등록한다(등록 블록은 run-node.sh 머리말) — 도구 결과는 바로 돌아오고,
// exit 2로 끝나면 stderr가 Claude에게 전달되며 쉬고 있던 세션도 깨어난다. 이상이 없으면 조용히 exit 0이다
// (exit 0의 additionalContext는 이 확장에서 전달되지 않았다 — 2026-09-30 스파이크).
//
// 배경: push·병합 뒤 같은 턴에 워크플로를 확인한 비율은 83%였고(직접 측정, 2026-08-31~09-30 트랜스크립트
// 314건), 확인하지 않은 채 "배포됨"이라 보고하는 것을 CLAUDE.md가 금지한다. 계획과 측정 방법:
// docs/plans/2026-09-30-rule-enforcement-phase3.md.
//
// 판정 요약:
//   - push: 명령의 원격·refspec(없으면 @{push})으로 대상 브랜치를 정하고, push 직후의 원격 추적 ref
//     (refs/remotes/<원격>/<브랜치>)로 SHA를 확정한다. 출력은 30KB를 넘기도 해서 up-to-date 판별에만 쓴다.
//   - gh pr create: 그 PR의 head SHA(PR CI). gh pr merge: 병합 커밋 SHA. 병합이 안 됐으면(--auto 등) 넘긴다.
//   - 실패한 Bash에는 PostToolUse가 안 뜬다. 워크트리에서 `gh pr merge --delete-branch`는 원격 병합이 끝난 뒤
//     로컬 브랜치 정리만 실패해 exit 1이 나므로, PostToolUseFailure에서는 gh pr merge만 본다.
//   - 같은 SHA를 두 번 보지 않게 os.tmpdir()에 SHA별 잠금 파일을 둔다(if 필터 두 개에 동시에 걸리는 명령,
//     push 뒤 PR 생성).
// 실패하면 통과시킨다(fail-open). 실행은 run-node.sh가 맡는다.
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { hasShortFlag, repoOf, resolveSegments } from '../lib/shell-parse.mjs';
import { formatReport, needsAttention, realGh, watchSha } from '../scripts/verify-deploy.mjs';

// 사용자 설정의 `timeout: 1800`보다 1분 짧게 — 훅이 강제 종료되기 전에 스스로 "시한 초과"를 보고한다.
export const DEADLINE_MS = 29 * 60_000;
const LOCK_DIR = path.join(os.tmpdir(), 'link-sphere-deploy-verify');

// 이런 push는 새 커밋을 올리지 않거나(삭제·dry-run) 브랜치 하나로 SHA를 특정할 수 없다(태그·mirror·all).
const PUSH_SKIP_FLAGS = new Set([
  '--delete',
  '--dry-run',
  '--tags',
  '--mirror',
  '--all',
  '--prune',
]);
const PUSH_VALUE_OPTIONS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);
const GH_MERGE_VALUE_OPTIONS = new Set([
  '-b',
  '--body',
  '-F',
  '--body-file',
  '-t',
  '--subject',
  '-A',
  '--author-email',
  '--match-head-commit',
  '-R',
  '--repo',
]);

function positionals(args, valueOptions) {
  const result = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (valueOptions.has(arg)) {
      i += 1;
    } else if (arg === '--') {
      result.push(...args.slice(i + 1));
      break;
    } else if (!arg.startsWith('-')) {
      result.push(arg);
    }
  }

  return result;
}

function optionValue(args, names) {
  for (let i = 0; i < args.length; i += 1) {
    const [name, inline] = args[i].split('=', 2);

    if (names.includes(name)) {
      return inline ?? args[i + 1] ?? null;
    }
  }

  return null;
}

/**
 * 명령 한 줄에서 감시할 이벤트를 찾는다. 순수 함수라 테스트·과거 명령 재생에 그대로 쓴다.
 * @returns {Array<{ kind: 'push'|'pr-create'|'pr-merge', dir: string, repo: 'FE'|'BE', args?: string[], slug?: string, selector?: string }>}
 */
export function findEvents({ command, cwd, failed = false }) {
  const events = [];

  for (const { words, git, dir } of resolveSegments(command, cwd)) {
    if (git?.sub === 'push') {
      const target = repoOf(dir);
      const skip =
        git.args.some((a) => PUSH_SKIP_FLAGS.has(a)) ||
        hasShortFlag(git.args, 'd') ||
        hasShortFlag(git.args, 'n');

      if (!failed && target && !skip) {
        events.push({ kind: 'push', dir, repo: target.repo, args: git.args });
      }

      continue;
    }

    if (words[0] !== 'gh' || words[1] !== 'pr' || !['create', 'merge'].includes(words[2])) {
      continue;
    }

    if (failed && words[2] !== 'merge') {
      continue;
    }

    const rest = words.slice(3);
    const slug = optionValue(rest, ['-R', '--repo']);
    const repo = (slug && repoOf(`/${slug}`)?.repo) || repoOf(dir)?.repo;

    if (!repo) {
      continue;
    }

    events.push({
      kind: words[2] === 'create' ? 'pr-create' : 'pr-merge',
      dir,
      repo,
      slug,
      selector:
        words[2] === 'merge' ? (positionals(rest, GH_MERGE_VALUE_OPTIONS)[0] ?? null) : null,
    });
  }

  return events;
}

/** 실제 git 실행기. 출력(trim) 또는 실패 시 null. */
export function realGit(args, dir) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

/** push 명령이 갱신한 원격 브랜치들. [{ remote, branch }] */
export function pushDestinations({ args, dir }, git = realGit) {
  const [remote, ...refspecs] = positionals(args, PUSH_VALUE_OPTIONS);

  if (refspecs.length === 0) {
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{push}'], dir);
    const slash = upstream ? upstream.indexOf('/') : -1;

    if (slash < 0) {
      return [];
    }

    return [{ remote: remote ?? upstream.slice(0, slash), branch: upstream.slice(slash + 1) }];
  }

  const destinations = [];

  for (const spec of refspecs) {
    const cleaned = spec.replace(/^\+/, '');
    const [src, dst = src] = cleaned.split(':');

    // `:브랜치`(소스 없음)는 원격 브랜치 삭제다.
    if (!src || !dst || src.startsWith('refs/tags/') || dst.startsWith('refs/tags/')) {
      continue;
    }

    const branch = dst === 'HEAD' ? git(['rev-parse', '--abbrev-ref', 'HEAD'], dir) : dst;

    if (branch && branch !== 'HEAD') {
      destinations.push({ remote, branch: branch.replace(/^refs\/heads\//, '') });
    }
  }

  return destinations;
}

/**
 * 이벤트 하나를 감시 대상(SHA)으로 바꾼다. 확정하지 못하면 빈 배열.
 * @returns {Array<{ sha: string, repo: string, isMain: boolean, cwd: string, repoSlug: string|null, source: string }>}
 */
export function resolveTargets(event, { output = '' } = {}, { git = realGit, gh = realGh } = {}) {
  if (event.kind === 'push') {
    if (output.includes('Everything up-to-date')) {
      return [];
    }

    return pushDestinations(event, git).flatMap(({ remote, branch }) => {
      const sha = git(['rev-parse', `refs/remotes/${remote}/${branch}`], event.dir);

      return sha
        ? [
            {
              sha,
              repo: event.repo,
              isMain: branch === 'main',
              cwd: event.dir,
              repoSlug: null,
              source: `${branch} push`,
            },
          ]
        : [];
    });
  }

  const merge = event.kind === 'pr-merge';
  let view;

  try {
    view = gh(
      [
        'pr',
        'view',
        ...(event.selector ? [event.selector] : []),
        '--json',
        merge ? 'number,state,mergeCommit,baseRefName' : 'number,state,headRefOid,baseRefName',
      ],
      { cwd: event.dir, repoSlug: event.slug }
    );
  } catch {
    return [];
  }

  const sha = merge ? (view.state === 'MERGED' ? view.mergeCommit?.oid : null) : view.headRefOid;

  if (!sha) {
    return [];
  }

  return [
    {
      sha,
      repo: event.repo,
      isMain: merge && view.baseRefName === 'main',
      cwd: event.dir,
      repoSlug: event.slug ?? null,
      source: merge ? `PR #${view.number} 병합 → ${view.baseRefName}` : `PR #${view.number} 생성`,
    },
  ];
}

/** SHA별 잠금. 잡으면 파일 경로, 다른 감시가 보는 중이면 null. 잠금 자체가 안 되면 감시는 진행한다. */
export function acquireLock(sha, { dir = LOCK_DIR, staleMs = DEADLINE_MS + 60_000 } = {}) {
  const file = path.join(dir, sha);

  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, String(process.pid), { flag: 'wx' });

    return file;
  } catch (error) {
    if (error.code !== 'EEXIST') {
      return 'unlocked';
    }
  }

  try {
    if (Date.now() - fs.statSync(file).mtimeMs > staleMs) {
      fs.writeFileSync(file, String(process.pid));

      return file;
    }
  } catch {
    return 'unlocked';
  }

  return null;
}

export function releaseLock(file) {
  if (!file || file === 'unlocked') {
    return;
  }

  try {
    fs.unlinkSync(file);
  } catch {
    // 이미 없으면 그만이다.
  }
}

async function watchTarget(target) {
  const lock = acquireLock(target.sha);

  if (!lock) {
    return null;
  }

  try {
    const result = await watchSha({ ...target, deadlineMs: DEADLINE_MS });

    return { target, result };
  } finally {
    releaseLock(lock);
  }
}

async function main() {
  let payload;

  try {
    payload = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }

  const command = payload?.tool_input?.command;

  if (typeof command !== 'string') {
    process.exit(0);
  }

  const events = findEvents({
    command,
    cwd: payload.cwd ?? process.cwd(),
    failed: payload.hook_event_name === 'PostToolUseFailure',
  });
  const output = String(payload.tool_response?.stdout ?? '');
  const targets = [];

  for (const event of events) {
    for (const target of resolveTargets(event, { output })) {
      if (!targets.some((t) => t.sha === target.sha)) {
        targets.push(target);
      }
    }
  }

  if (targets.length === 0) {
    process.exit(0);
  }

  const watched = await Promise.all(targets.map(watchTarget));
  const reports = watched
    .filter((w) => w && needsAttention(w.result))
    .map((w) => formatReport(w.result, { ...w.target, deadlineMs: DEADLINE_MS }));

  if (reports.length > 0) {
    process.stderr.write(`${reports.join('\n\n')}\n`);
    process.exit(2);
  }

  process.exit(0);
}

function isEntrypoint() {
  try {
    return (
      Boolean(process.argv[1]) &&
      fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  main().catch(() => process.exit(0));
}
