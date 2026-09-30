// 셸 명령을 하위 명령 단위로 쪼개고 git 호출·link-sphere 경로를 해석하는 공용 모듈. 트랜스크립트
// 측정기(.claude/scripts/rule-metrics.mjs)와 PreToolUse 가드(.claude/hooks/bash-guard.mjs,
// edit-guard.mjs)가 함께 쓴다 — 측정기가 "위반"으로 세는 명령과 가드가 막는 명령의 판정이 어긋나지
// 않게 하기 위함이다.
//
// 다루는 셸 문법: 따옴표, 백슬래시, 줄 이음(\ + 개행), heredoc 본문(인용 안에 있어도), 리다이렉션
// (2>&1, >/dev/null, &>, <<<), 줄 끝 주석(#), ; && || | & 개행, 서브셸 ( ) 과 $( ), 중괄호 그룹,
// if/then/do/while 같은 제어어, env·command·time·nohup·nice·timeout·xargs 같은 앞머리, cd·pushd.
// 정직한 한계: 간이 파서다. 변수 전개 결과, 별칭, 함수, `bash -c "..."`·`eval` 안의 명령, 스크립트
// 파일 안의 명령은 보지 못한다. 경로를 확정할 수 없으면(예: cd "$DIR") 디렉터리를 "모름"(null)으로
// 두고, 가드는 그 하위 명령의 git 판정을 건너뛴다(fail-open).
import os from 'os';
import path from 'path';

// 레포·워크트리는 git을 부르지 않고 경로 문자열로 판정한다(계획은 `git rev-parse`였다). 가드는 모든
// git·rm 호출마다 도므로 호출 수를 줄이고, 측정기는 이미 사라진 과거 경로도 판정해야 하기 때문이다.
// EnterWorktree는 항상 <레포>/.claude/worktrees/<이름>에 워크트리를 만드므로 이 표식으로 충분하다 —
// 그 밖에 손으로 만든 워크트리나 심볼릭 링크 별칭 경로는 알아보지 못한다.
export const WORKTREE_MARKER = '/.claude/worktrees/';
export const REPO_PATTERN = /\/link-sphere_(FE|BE)_NEW(\/|$)/;

// `git commit`에서 값을 받는 옵션. `--` 뒤에 오면 경로로 읽혀 pathspec 오류가 난다.
export const COMMIT_OPTIONS_WITH_VALUE = new Set([
  '-m',
  '-F',
  '--message',
  '--file',
  '--amend',
  '-C',
  '-c',
]);

// 값을 따로 받는 `git commit` 옵션(경로 인자를 셀 때 그 값을 건너뛴다).
const COMMIT_VALUE_OPTIONS = new Set([
  '-m',
  '-F',
  '-C',
  '-c',
  '-t',
  '--message',
  '--file',
  '--author',
  '--date',
  '--template',
  '--cleanup',
  '--fixup',
  '--squash',
  '--reuse-message',
  '--reedit-message',
]);
const COMMIT_VALUE_SHORT = new Set(['m', 'F', 'C', 'c', 't']);

// 경로를 함께 주지 않으면 작업 트리 전체를 대상으로 하는 `git add` 옵션. 경로를 주면 그 경로
// 안으로 범위가 좁혀지므로 광범위가 아니다(`git add -A -- docs/plans/x.md`).
const BROAD_ADD_FLAGS = new Set(['-A', '--all', '-u', '--update', '--no-ignore-removal']);

// 하위 명령 앞에 붙어 실제 명령을 뒤로 미는 단어.
const PREFIX_WORDS = new Set([
  'env',
  'command',
  'builtin',
  'exec',
  'nohup',
  '!',
  '{',
  'then',
  'do',
  'else',
  'elif',
  'if',
  'while',
  'until',
]);
const CLOSER_WORDS = new Set(['}', 'fi', 'done', 'esac']);
const XARGS_VALUE_OPTIONS = new Set(['-I', '-n', '-P', '-L', '-d', '-E', '-s', '-a']);

const SUBSHELL_OPEN = '\u0000(';
const SUBSHELL_CLOSE = '\u0000)';

/** heredoc 본문을 지운다 — 인용 안(`"$(cat <<'EOF' ... EOF)"`)에 있어도 본문 속 따옴표가 토크나이저를 어긋나게 하지 않도록. */
function stripHeredocBodies(command) {
  const lines = command.split('\n');
  const kept = [];
  const pending = [];
  const operator = /(^|[^<])<<-?\s*(?:'([^']*)'|"([^"]*)"|\\?([^\s'"<>|&;()]+))/g;

  for (const line of lines) {
    if (pending.length > 0) {
      if (line.trim() === pending[0]) {
        pending.shift();
      }

      continue;
    }

    kept.push(line);

    for (const match of line.matchAll(operator)) {
      pending.push(match[2] ?? match[3] ?? match[4]);
    }
  }

  return kept.join('\n');
}

/** start부터 한 단어(따옴표 포함)를 건너뛴 위치를 돌려준다 — 리다이렉션 대상 소비용. */
function skipWord(command, start) {
  let j = start;
  let quote = null;

  while (j < command.length) {
    const c = command[j];

    if (quote) {
      if (c === quote) {
        quote = null;
      } else if (c === '\\' && quote === '"') {
        j += 1;
      }

      j += 1;
      continue;
    }

    if (c === "'" || c === '"') {
      quote = c;
      j += 1;
      continue;
    }

    if (c === '\\') {
      j += 2;
      continue;
    }

    if (/[\s;&|()<>]/.test(c)) {
      break;
    }

    j += 1;
  }

  return j;
}

/**
 * 셸 명령을 따옴표·heredoc·리다이렉션을 고려해 하위 명령(단어 배열) 목록으로 쪼갠다.
 * 서브셸 경계는 SUBSHELL_OPEN/CLOSE 표지 세그먼트로 남긴다(resolveSegments가 cd 범위에 쓴다).
 */
export function splitShellCommand(rawCommand) {
  const command = stripHeredocBodies(rawCommand);
  const segments = [];
  let words = [];
  let word = '';
  let hasWord = false;
  let quote = null;

  const endWord = () => {
    if (hasWord) {
      words.push(word);
    }

    word = '';
    hasWord = false;
  };
  const endSegment = () => {
    endWord();

    if (words.length > 0) {
      segments.push(words);
    }

    words = [];
  };
  const pushMarker = (marker) => {
    endSegment();
    segments.push([marker]);
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && quote === '"' && i + 1 < command.length) {
        word += command[++i];
      } else {
        word += ch;
      }

      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      hasWord = true;
      continue;
    }

    if (ch === '\\') {
      if (command[i + 1] === '\n') {
        i += 1;
        continue;
      }

      if (i + 1 < command.length) {
        word += command[++i];
        hasWord = true;
      }

      continue;
    }

    if (ch === '#' && !hasWord) {
      const lineEnd = command.indexOf('\n', i);
      i = lineEnd === -1 ? command.length : lineEnd - 1;
      continue;
    }

    if (ch === '(') {
      if (word.endsWith('$')) {
        word = word.slice(0, -1);
        hasWord = word.length > 0;
      }

      pushMarker(SUBSHELL_OPEN);
      continue;
    }

    if (ch === ')') {
      pushMarker(SUBSHELL_CLOSE);
      continue;
    }

    if (ch === '>' || ch === '<' || (ch === '&' && command[i + 1] === '>')) {
      if (hasWord && !/^\d+$/.test(word)) {
        endWord();
      } else {
        word = '';
        hasWord = false;
      }

      let j = i;

      if (command[j] === '&') {
        j += 1;
      }

      while (command[j] === '>' || command[j] === '<') {
        j += 1;
      }

      if (command[j] === '&') {
        const dup = command.slice(j + 1).match(/^(\d+|-)/);

        if (dup) {
          i = j + dup[0].length;
          continue;
        }

        j += 1;
      }

      if (command[j] === '|') {
        j += 1;
      }

      while (command[j] === ' ' || command[j] === '\t') {
        j += 1;
      }

      i = skipWord(command, j) - 1;
      continue;
    }

    if (ch === '\n' || ch === ';') {
      endSegment();
      continue;
    }

    if (ch === '&' || ch === '|') {
      endSegment();

      if (command[i + 1] === ch) {
        i += 1;
      }

      continue;
    }

    if (ch === ' ' || ch === '\t') {
      endWord();
      continue;
    }

    word += ch;
    hasWord = true;
  }

  endSegment();

  return segments;
}

/** 하위 명령의 앞쪽 환경변수 대입·제어어·래퍼(`env`, `time`, `timeout N`, `xargs -I {}` 등)를 벗긴다. */
export function stripPrefix(words) {
  let index = 0;

  while (index < words.length) {
    const current = words[index];

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(current) || PREFIX_WORDS.has(current)) {
      index += 1;
    } else if (current === 'time') {
      index += words[index + 1] === '-p' ? 2 : 1;
    } else if (current === 'nice') {
      index += words[index + 1] === '-n' ? 3 : 1;
    } else if (current === 'timeout' && index + 1 < words.length) {
      index += 2;
    } else if (current === 'xargs') {
      index += 1;

      while (index < words.length && words[index].startsWith('-')) {
        index += XARGS_VALUE_OPTIONS.has(words[index]) ? 2 : 1;
      }
    } else {
      break;
    }
  }

  return words.slice(index);
}

/** cd·git -C 대상 경로를 확정한다. 변수·명령 치환이 섞였거나 기준 디렉터리를 모르면 null. */
function resolveDir(base, target) {
  if (target === undefined) {
    return os.homedir();
  }

  if (/[$`]/.test(target) || target === '-') {
    return null;
  }

  const expanded = target.replace(/^~(?=$|\/)/, os.homedir());

  if (path.isAbsolute(expanded)) {
    return path.resolve(expanded);
  }

  return base ? path.resolve(base, expanded) : null;
}

/** `git [-C dir] [-c k=v] <sub> args...`를 풀어 { dir, sub, args }로 돌려준다. git이 아니면 null. dir은 -C가 없으면 undefined. */
export function parseGit(words, base) {
  if (words[0] !== 'git') {
    return null;
  }

  let dir;
  let index = 1;

  while (index < words.length && words[index].startsWith('-')) {
    if (words[index] === '-C') {
      dir = resolveDir(dir === undefined ? base : dir, words[index + 1] ?? '');
      index += 2;
    } else if (words[index] === '-c') {
      index += 2;
    } else {
      index += 1;
    }
  }

  const sub = words[index] === 'stage' ? 'add' : (words[index] ?? null);

  return { dir, sub, args: words.slice(index + 1) };
}

/** 명령 한 줄에서 (하위 명령, 그 명령이 실행될 디렉터리) 쌍을 만든다. cd·pushd·git -C·서브셸 범위를 따라간다. dir이 null이면 모름. */
export function resolveSegments(command, cwd) {
  let current = cwd || null;
  const stack = [];
  const resolved = [];

  for (const raw of splitShellCommand(command)) {
    if (raw[0] === SUBSHELL_OPEN) {
      stack.push(current);
      continue;
    }

    if (raw[0] === SUBSHELL_CLOSE) {
      current = stack.length > 0 ? stack.pop() : current;
      continue;
    }

    const words = stripPrefix(raw);

    if (words.length === 0 || (words.length === 1 && CLOSER_WORDS.has(words[0]))) {
      continue;
    }

    if (words[0] === 'cd' || words[0] === 'pushd') {
      current = resolveDir(current, words[1]);
      continue;
    }

    if (words[0] === 'popd') {
      current = null;
      continue;
    }

    const git = parseGit(words, current);
    const dir = git && git.dir !== undefined ? git.dir : current;
    resolved.push({ words, git, dir });
  }

  return resolved;
}

/** 작업 트리 루트·패턴·pathspec magic처럼 범위를 넓게 잡는 경로 인자인지. */
export function isBroadPathspec(arg) {
  return arg === '.' || arg === './' || arg.startsWith(':') || /[*?[]/.test(arg);
}

/** 옵션을 뺀 경로 인자만. `--` 뒤는 전부 경로다. */
export function pathArgs(args) {
  const dashIndex = args.indexOf('--');

  if (dashIndex !== -1) {
    return [
      ...args.slice(0, dashIndex).filter((a) => !a.startsWith('-')),
      ...args.slice(dashIndex + 1),
    ];
  }

  return args.filter((a) => !a.startsWith('-'));
}

/** 짧은 옵션 묶음(-fd 등)에 해당 글자가 있는지. */
export function hasShortFlag(args, letter) {
  return args.some((a) => /^-[A-Za-z]+$/.test(a) && a.slice(1).includes(letter));
}

/** `git add`가 광범위 스테이징이면 그 원인 인자를, 아니면 null을 돌려준다. 미리보기(-n)는 광범위가 아니다. */
export function broadAddArg(args) {
  if (args.includes('--dry-run') || hasShortFlag(args, 'n')) {
    return null;
  }

  const paths = pathArgs(args);
  const broadPath = paths.find(isBroadPathspec);

  if (broadPath) {
    return broadPath;
  }

  if (paths.length === 0) {
    return args.find((a) => BROAD_ADD_FLAGS.has(a)) ?? null;
  }

  return null;
}

/** `git commit`의 경로 인자(옵션 값은 건너뜀). */
export function commitPathArgs(args) {
  const paths = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--') {
      paths.push(...args.slice(i + 1));
      break;
    }

    if (COMMIT_VALUE_OPTIONS.has(arg)) {
      i += 1;
      continue;
    }

    if (!arg.startsWith('-')) {
      paths.push(arg);
    }
  }

  return paths;
}

/** `git commit -a`/`--all`/`-am"..."`, 또는 `.`·`:/` 같은 전체 경로 커밋인지. */
export function isCommitAll(args) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--') {
      break;
    }

    if (arg === '--all') {
      return true;
    }

    if (COMMIT_VALUE_OPTIONS.has(arg)) {
      i += 1;
      continue;
    }

    if (/^-[A-Za-z]/.test(arg)) {
      for (const letter of arg.slice(1)) {
        if (letter === 'a') {
          return true;
        }

        if (COMMIT_VALUE_SHORT.has(letter)) {
          break;
        }
      }
    }
  }

  return commitPathArgs(args).some(isBroadPathspec);
}

/** `git commit`에서 값을 받는 옵션(-m 등)이 `--` 뒤에 왔는지 — pathspec 오류의 인자 순서 원인. */
export function hasOptionAfterDoubleDash(args) {
  const dashIndex = args.indexOf('--');

  if (dashIndex === -1) {
    return false;
  }

  return args
    .slice(dashIndex + 1)
    .some((arg) => COMMIT_OPTIONS_WITH_VALUE.has(arg) || /^--(message|file)=/.test(arg));
}

/**
 * 워크트리 전체(또는 모든 세션이 공유하는 stash 스택)에 영향을 주는 git 명령의 종류. 해당 없으면 null.
 * 측정기 M3와 가드 G4가 같은 판정을 쓴다.
 */
export function destructiveKind({ sub, args }) {
  if (sub === 'stash') {
    return ['list', 'show'].includes(args[0]) ? null : 'stash';
  }

  if (sub === 'reset') {
    return args.includes('--hard') ? 'reset --hard' : null;
  }

  if (sub === 'checkout') {
    if (pathArgs(args).some(isBroadPathspec)) {
      return 'checkout -- .';
    }

    return args.includes('--force') || hasShortFlag(args, 'f') ? 'checkout -f' : null;
  }

  if (sub === 'restore') {
    const staged = args.includes('--staged') || hasShortFlag(args, 'S');
    const worktree = args.includes('--worktree') || hasShortFlag(args, 'W');

    if (staged && !worktree) {
      return null;
    }

    return pathArgs(args).some(isBroadPathspec) ? 'restore .' : null;
  }

  if (sub === 'switch') {
    const discard =
      args.includes('--discard-changes') || args.includes('--force') || hasShortFlag(args, 'f');

    return discard ? 'switch --discard-changes' : null;
  }

  if (sub === 'clean') {
    const force = args.includes('--force') || hasShortFlag(args, 'f');
    const dryRun = args.includes('--dry-run') || hasShortFlag(args, 'n');

    return force && !dryRun ? 'clean -f' : null;
  }

  return null;
}

export function isWorktreePath(p) {
  return typeof p === 'string' && p.includes(WORKTREE_MARKER);
}

/** 경로가 속한 link-sphere 레포('FE'|'BE')와 메인 체크아웃 루트. 아니면 null. */
export function repoOf(p) {
  const match = typeof p === 'string' ? p.match(REPO_PATTERN) : null;

  if (!match) {
    return null;
  }

  return { repo: match[1], mainRoot: `${p.slice(0, match.index)}/link-sphere_${match[1]}_NEW` };
}

/** 워크트리 안 경로면 그 워크트리 루트(…/.claude/worktrees/<name>), 아니면 null. */
export function worktreeRootOf(p) {
  if (!isWorktreePath(p)) {
    return null;
  }

  const markerIndex = p.indexOf(WORKTREE_MARKER);
  const name = p.slice(markerIndex + WORKTREE_MARKER.length).split('/')[0];

  return `${p.slice(0, markerIndex)}${WORKTREE_MARKER}${name}`;
}

/**
 * 메인 체크아웃을 건드리려는 세션에게 줄 다음 행동 안내. 세션 위치에 따라 달라진다:
 * 같은 레포 워크트리 안 → 워크트리 쪽에서 하라, 같은 레포 메인 → EnterWorktree, 다른 곳 → 그 레포 세션 요청.
 */
export function sessionAdvice({ repo, sessionCwd, relative }) {
  const session = repoOf(sessionCwd);
  const worktreeRoot = worktreeRootOf(sessionCwd);

  if (session && session.repo === repo && worktreeRoot) {
    const target = relative ? `${worktreeRoot}/${relative}` : worktreeRoot;

    return `이 세션은 이미 워크트리(${worktreeRoot}) 안에 있다. 메인 체크아웃으로 cd하지 말고 워크트리 쪽(${target})에서 한다.`;
  }

  if (session && session.repo === repo) {
    return `EnterWorktree로 워크트리를 만든 뒤${relative ? `, 워크트리 안의 같은 상대 경로(${relative})에서` : ' 그 안에서'} 한다.`;
  }

  return (
    `이 세션(cwd: ${sessionCwd || '알 수 없음'})은 link-sphere ${repo} 레포 세션이 아니다. EnterWorktree는 현재 레포의 워크트리만 만든다. ` +
    `${repo} 레포 작업이 필요하면 멈추고, 사용자에게 link-sphere_${repo}_NEW에서 세션을 열어 달라고 요청한다.`
  );
}
