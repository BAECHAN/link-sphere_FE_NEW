// PreToolUse(Bash) 가드 — link-sphere의 워크트리·커밋 규칙(.claude/CLAUDE.md) 중 명령 문자열만 보고
// 판정할 수 있는 것을 실행 직전에 막는다. 문서 규칙만으로는 위반이 계속 나와 규칙을 "요청"에서
// "강제"로 옮겼다(docs/plans/2026-09-29-rule-enforcement-hardening.md Phase 2). 직접 측정 —
// `node .claude/scripts/rule-metrics.mjs --since 2026-08-31 --until 2026-09-29`(2026-09-30 실행):
// git add 335건, link-sphere stash 30건, rm 거부 180건. 계획 파일의 수치(git add 340·stash 27)는
// 측정기를 만들기 전의 1차 조사값이다. 실행은 run-node.sh가 맡는다(사용자 설정에 등록).
//
// 판정(git 규칙은 link-sphere FE·BE 레포 안에서만 — 다른 레포는 그대로 통과):
//   G2 메인 체크아웃의 git add·git rm → 차단(메인 체크아웃 index는 세션끼리 공유)
//   G1 광범위 스테이징(경로 없는 git add -A/-u, `.`·glob·`:/` 경로, git commit -a, 전체 경로 커밋,
//      git rm .) → 차단
//   G2′ 워크트리 안 git add → 한 번도 추적되지 않은 경로만 허용(충돌 해결 중이면 허용)
//   G3 git commit에서 -m·-F 등이 `--` 뒤 → 차단(경로로 읽혀 pathspec 오류)
//   G4 stash → 서브에이전트는 차단, 메인 스레드는 사용자 확인(ask). reset --hard·checkout -- .·
//      checkout -f·restore .·switch --discard-changes·clean -f → 차단
//   rm → 차단하고 사용자에게 줄 절대경로 명령을 안내(rm은 사용자 설정에서 전역 차단 — 모든 레포)
//
// 실패하면 통과시킨다(fail-open) — 파싱·git 호출이 실패해 정당한 작업을 막는 것보다 한 번
// 놓치는 쪽이 낫고, 놓친 것은 rule-metrics.mjs가 사후에 센다. 셸 파싱의 한계는
// .claude/lib/shell-parse.mjs 머리말 참고.
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  broadAddArg,
  destructiveKind,
  hasOptionAfterDoubleDash,
  hasShortFlag,
  isBroadPathspec,
  isCommitAll,
  isWorktreePath,
  pathArgs,
  repoOf,
  resolveSegments,
  sessionAdvice,
} from '../lib/shell-parse.mjs';

const RULE_REF = 'link-sphere 워크트리·커밋 규칙(.claude/CLAUDE.md)';
const CONFLICT_MARKERS = [
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
  'rebase-merge',
  'rebase-apply',
];
const PATHSPEC_FILE_SUBCOMMANDS = new Set(['add', 'rm', 'commit', 'checkout', 'restore']);

const realGit = {
  /** 경로(파일·디렉터리)에 속한 추적 파일 목록. 알 수 없으면 null. */
  trackedPaths(dir, pathspec) {
    try {
      const out = execFileSync('git', ['-C', dir, 'ls-files', '--', pathspec], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      });

      return out.split('\n').filter(Boolean);
    } catch {
      return null;
    }
  },
  /** merge·rebase·cherry-pick·revert 충돌 해결 중인지. 알 수 없으면 null. */
  inConflict(dir) {
    try {
      const gitDir = execFileSync('git', ['-C', dir, 'rev-parse', '--absolute-git-dir'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      }).trim();

      return CONFLICT_MARKERS.some((marker) => fs.existsSync(path.join(gitDir, marker)));
    } catch {
      return null;
    }
  },
};

/** rm 대상 인자를 사용자에게 줄 절대경로로 바꾼다. 변수가 섞이면 확정하지 않고 표시만 한다. */
function rmTarget(arg, dir) {
  if (/[$`]/.test(arg)) {
    return { text: arg, unresolved: true };
  }

  const expanded = arg.replace(/^~(?=$|\/)/, os.homedir());
  const absolute = dir || path.isAbsolute(expanded) ? path.resolve(dir || '/', expanded) : expanded;

  if (/[*?[]/.test(absolute)) {
    return { text: absolute, unresolved: false };
  }

  const text = /^[\w@%+=:,./-]+$/.test(absolute)
    ? absolute
    : `'${absolute.replace(/'/g, `'\\''`)}'`;

  return { text, unresolved: false };
}

function rmMessage(words, dir) {
  const rest = words.slice(1);
  const flags = rest.filter((w) => w.startsWith('-'));
  const targets = rest.filter((w) => !w.startsWith('-')).map((t) => rmTarget(t, dir));
  const suggestion = ['rm', ...flags, ...targets.map((t) => t.text)].join(' ');
  const lines = [
    '[bash-guard] rm은 이 환경의 사용자 설정(permissions.deny)에서 전역 차단돼 있어 다시 실행해도 막힌다.',
    '재시도하거나 find -delete·unlink·git clean·스크립트·(미추적 파일에 대한) git rm으로 우회하지 않는다.',
    '대신 사용자가 그대로 복사해 실행할 수 있게 절대경로 명령을 코드블록으로 제시한다:',
    `  ${suggestion}`,
  ];

  if (targets.some((t) => t.unresolved)) {
    lines.push(
      '($로 시작하는 변수 경로는 절대경로로 확정하지 못했다 — 실제 경로로 바꿔 제시한다.)'
    );
  }

  if (repoOf(dir)) {
    lines.push(
      `git이 추적하는 파일을 지우려던 거라면 워크트리 안에서 git rm <경로>를 쓴다(${RULE_REF}).`
    );
  }

  return lines.join('\n');
}

const MESSAGES = {
  mainCheckoutStage: (sub, dir, sessionCwd) => {
    const repo = repoOf(dir).repo;

    return (
      `[bash-guard] link-sphere ${repo} 메인 체크아웃(${dir})에서 git ${sub}는 금지다 — 메인 체크아웃의 index는 ` +
      `여러 세션이 공유해 남의 변경이 커밋에 섞인다(${RULE_REF}). ${sessionAdvice({ repo, sessionCwd })}`
    );
  },
  broadAdd: (arg) =>
    `[bash-guard] git add ${arg}처럼 작업 트리 전체나 패턴을 스테이징하는 명령은 금지다(${RULE_REF}). ` +
    '같은 워크트리를 쓰는 다른 에이전트의 변경까지 섞여 들어간다. 커밋할 경로를 하나씩 지정한다: ' +
    '추적 중인 파일은 add 없이 git commit -m "<메시지>" -- <경로...>, 한 번도 추적되지 않은 새 파일만 git add -- <새 파일>.',
  trackedAdd: (arg, tracked) =>
    `[bash-guard] ${arg}에는 이미 git이 추적하는 파일이 있다(${tracked.slice(0, 3).join(', ')}` +
    `${tracked.length > 3 ? ' 등' : ''}). 워크트리 안의 git add는 한 번도 추적되지 않은 새 파일에만 쓴다(${RULE_REF}). ` +
    '추적 중인 파일은 add 없이 git commit -m "<메시지>" -- <경로...>로 커밋하고, 새 파일만 따로 git add -- <새 파일>.',
  pathspecFile: (sub) =>
    `[bash-guard] git ${sub} --pathspec-from-file은 어떤 경로가 대상인지 이 가드가 확인할 수 없다(${RULE_REF}). ` +
    '경로를 명령줄에 직접 나열한다.',
  commitOrder: () =>
    '[bash-guard] git commit에서 -m·-F·--amend 같은 옵션이 `--` 뒤에 있다. `--` 뒤는 전부 경로로 읽혀 ' +
    '"pathspec did not match" 오류가 난다. 옵션을 `--` 앞으로 옮긴다: git commit -m "<메시지>" -- <경로...>',
  commitAll: (concluding) =>
    `[bash-guard] git commit -a/--all이나 \`.\`·\`:/\` 같은 전체 경로 커밋은 추적 중인 모든 변경을 커밋에 넣는다(${RULE_REF}). ` +
    (concluding
      ? '충돌 해결 중에는 git이 경로 지정 커밋을 거부한다. 해결한 파일을 git add -- <파일>로 올린 뒤 경로 없이 ' +
        'git commit -m "<메시지>"로 마무리한다(rebase 중이면 git rebase --continue).'
      : '커밋할 경로를 지정한다: git commit -m "<메시지>" -- <경로...>'),
  broadRm: (arg) =>
    `[bash-guard] git rm ${arg}처럼 범위를 넓게 지우는 명령은 금지다(${RULE_REF}). 지울 경로를 하나씩 지정한다.`,
  destructive: (label, isSubagent) =>
    `[bash-guard] git ${label}는 워크트리 전체(또는 모든 세션이 공유하는 stash 스택)에 영향을 주는 되돌리기 어려운 명령이라 ` +
    `${isSubagent ? '서브에이전트에서는' : 'Claude가'} 실행하지 않는다(${RULE_REF}). ` +
    '필요하면 사용자에게 이유와 함께 명령을 제시하고 직접 실행을 요청한다. 작업을 잠시 치워두려면 임시 WIP 커밋을 쓴다.',
  cleanPaths: () =>
    '[bash-guard] git clean -f로 미추적 파일을 지우는 건 전역 차단된 rm을 우회하는 것이다. ' +
    '같은 인자에 -f 대신 -n을 붙인 git clean -n …으로 지워질 목록만 확인하고, 그 목록의 파일만 절대경로 rm 명령으로 ' +
    '사용자에게 코드블록으로 제시한다(-e로 제외한 파일·추적 파일은 넣지 않는다).',
  stashAskUser:
    'git stash는 모든 세션·워크트리가 공유하는 stash 스택을 건드린다 — 실행할지 확인이 필요하다.',
  stashAskClaude:
    '[bash-guard] git stash 스택은 메인 체크아웃·모든 워크트리·세션이 공유한다 — 다른 세션의 항목을 pop·drop할 수 있다. ' +
    '작업을 잠시 치워두려면 임시 WIP 커밋이 안전하다. stash가 꼭 필요하면 git stash push -u -m "<고유 태그>"로 만들고, ' +
    'git stash list --format="%H %gs"로 SHA를 확인해 git stash apply <sha>로 복원한다(pop·clear는 쓰지 않는다).',
};

/**
 * 명령 하나에 대한 판정. 순수 함수라 테스트·과거 명령 재생에 그대로 쓴다.
 * @returns {{ action: 'allow' } | { action: 'deny', reason: string } | { action: 'ask', reason: string, context: string }}
 */
export function decide({ command, cwd, agentId }, git = realGit) {
  const isSubagent = Boolean(agentId);
  let ask = null;

  for (const { words, git: parsed, dir } of resolveSegments(command, cwd)) {
    if (words[0] === 'rm') {
      return { action: 'deny', reason: rmMessage(words, dir) };
    }

    if (!parsed || !parsed.sub || !repoOf(dir)) {
      continue;
    }

    const { sub, args } = parsed;
    const inWorktree = isWorktreePath(dir);

    if (
      PATHSPEC_FILE_SUBCOMMANDS.has(sub) &&
      args.some((a) => a.startsWith('--pathspec-from-file'))
    ) {
      return { action: 'deny', reason: MESSAGES.pathspecFile(sub) };
    }

    if (sub === 'add' || sub === 'rm') {
      if (!inWorktree) {
        return { action: 'deny', reason: MESSAGES.mainCheckoutStage(sub, dir, cwd) };
      }

      if (sub === 'rm') {
        const broad = pathArgs(args).find(isBroadPathspec);

        if (broad) {
          return { action: 'deny', reason: MESSAGES.broadRm(broad) };
        }

        continue;
      }

      const broad = broadAddArg(args);

      if (broad) {
        return { action: 'deny', reason: MESSAGES.broadAdd(broad) };
      }

      const dryRun = args.includes('--dry-run') || hasShortFlag(args, 'n');

      // 충돌 중에는 충돌 파일만이 아니라 추적 파일 add를 모두 허용한다 — 해결하다 빌드를 맞추려고 다른
      // 파일을 고쳐 올리는 것도 정당하고, 워크트리 index는 따로라 다른 세션에 번지지 않는다.
      if (dryRun || git.inConflict(dir) === true) {
        continue;
      }

      for (const arg of pathArgs(args)) {
        const tracked = git.trackedPaths(dir, arg);

        if (tracked && tracked.length > 0) {
          return { action: 'deny', reason: MESSAGES.trackedAdd(arg, tracked) };
        }
      }

      continue;
    }

    if (sub === 'commit') {
      if (hasOptionAfterDoubleDash(args)) {
        return { action: 'deny', reason: MESSAGES.commitOrder() };
      }

      if (isCommitAll(args)) {
        const concluding = inWorktree && git.inConflict(dir) === true;

        return { action: 'deny', reason: MESSAGES.commitAll(concluding) };
      }

      continue;
    }

    const kind = destructiveKind(parsed);

    if (kind === 'stash') {
      if (isSubagent) {
        return { action: 'deny', reason: MESSAGES.destructive('stash', true) };
      }

      ask = ask ?? { reason: MESSAGES.stashAskUser, context: MESSAGES.stashAskClaude };
      continue;
    }

    if (kind === 'clean -f' && pathArgs(args).length > 0 && !pathArgs(args).some(isBroadPathspec)) {
      return { action: 'deny', reason: MESSAGES.cleanPaths() };
    }

    if (kind) {
      return { action: 'deny', reason: MESSAGES.destructive(kind, isSubagent) };
    }
  }

  return ask ? { action: 'ask', ...ask } : { action: 'allow' };
}

function main() {
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

  let result;

  try {
    result = decide({ command, cwd: payload.cwd ?? process.cwd(), agentId: payload.agent_id });
  } catch {
    process.exit(0);
  }

  if (result.action === 'deny') {
    process.stderr.write(`${result.reason}\n`);
    process.exit(2);
  }

  if (result.action === 'ask') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: result.reason,
          additionalContext: result.context,
        },
      })
    );
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
  main();
}
