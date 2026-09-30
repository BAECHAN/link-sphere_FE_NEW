// Claude Code 세션 트랜스크립트(~/.claude/projects/*link-sphere*)를 읽어 CLAUDE.md 규칙 위반을
// 사후 집계한다. 2026-09-29, "문서에 적어도 가끔 어긴다"는 문제를 조사하면서 만든 측정기다 —
// 규칙을 훅·문구로 바꿀 때마다 "실제로 행동이 바뀌었는가"를 같은 방법으로 전후 비교하기 위해
// 쓴다(계획과 기준선 수치는 docs/plans/2026-09-29-rule-enforcement-hardening.md).
//
// 로컬 전용이다 — CI나 package.json에 등록하지 않는다(트랜스크립트는 이 머신에만 있다).
// 출력은 집계 수치와 세션 id뿐이고 메시지 본문은 옮기지 않는다.
//
// 사용법:
//   node .claude/scripts/rule-metrics.mjs [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--json]
//   (날짜는 이벤트 timestamp의 UTC 날짜 기준, 양 끝 포함)
//
// 정직한 한계: 전부 휴리스틱이다. 셸 명령은 간이 토크나이저로 쪼개므로 `$(...)` 안의 명령이나
// 별칭(alias)은 못 본다. 언어 판정은 글자 종류 비율로만 한다(코드·URL 제거 후 한글 0자 +
// 라틴 단어 3개 이상이면 영어). 트랜스크립트는 cleanupPeriodDays가 지나면 지워지므로 오래된
// 기간은 다시 잴 수 없다 — 기준선 수치는 PR 본문에 남긴다.
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PROJECTS_ROOT = path.join(os.homedir(), '.claude', 'projects');
const PROJECT_DIR_PREFIX = '-Users-baechan-project-link-sphere-link-sphere-';
const WORKTREE_MARKER = '/.claude/worktrees/';
const REPO_PATTERN = /\/link-sphere_(FE|BE)_NEW(\/|$)/;

// 규칙·메모리가 생긴 날짜. 이 날짜 전후로 나눠 보고한다.
const RULE_DATES = {
  rmMemory: '2026-09-11',
  sharedWorktreeStash: '2026-09-27',
};

// 발동 횟수(M12)를 셀 훅 스크립트. 트랜스크립트에는 훅이 막은 기록이 `[<실행 명령>]: <stderr>`
// 형태로 남으므로(PostToolUse는 attachment `hook_blocking_error`, PreToolUse는 tool_result의
// `PreToolUse:<도구> hook error:`) 명령 안의 스크립트 파일명으로 구분한다. 문구로 세면 훅
// 스크립트나 문서를 Read한 기록까지 잡힌다.
const HOOK_SCRIPTS = [
  'plan-diagram-reminder.sh',
  'filename-case-check.sh',
  'bash-guard.sh',
  'edit-guard.sh',
];
const PRE_TOOL_HOOK_ERROR = /^PreToolUse:\w+ hook error: \[/;

const PATHSPEC_ERROR = 'did not match any file(s) known to git';
// pathspec 오류 뒤 이만큼의 Bash 결과 안에 `create mode`(새 파일 커밋)가 나오면 새 파일이 원인이었다고 본다.
const PATHSPEC_FOLLOWUP_WINDOW = 4;
// git add 직전 이만큼의 Bash 결과 안에 충돌 신호가 있으면 충돌 해결 중 add로 본다.
const CONFLICT_WINDOW = 10;
const CONFLICT_SIGNAL = /CONFLICT \(|Merge conflict|could not apply|fix conflicts/i;
const DENIAL_PATTERN = /^Permission to use Bash with command [\s\S]* has been denied/;
const COMMIT_OPTIONS_WITH_VALUE = new Set([
  '-m',
  '-F',
  '--message',
  '--file',
  '--amend',
  '-C',
  '-c',
]);
const BROAD_ADD_ARGS = new Set([
  '-A',
  '--all',
  '.',
  '-u',
  '--update',
  ':/',
  '*',
  '--no-ignore-removal',
]);

function parseArgs(argv) {
  const options = { since: null, until: null, json: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--since') {
      options.since = argv[++i];
    } else if (arg === '--until') {
      options.until = argv[++i];
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

/** 링크스피어 프로젝트 디렉터리 아래 메인·서브에이전트 트랜스크립트 목록을 모은다. */
function collectTranscripts() {
  const result = [];

  for (const dirName of fs.readdirSync(PROJECTS_ROOT)) {
    if (!dirName.startsWith(PROJECT_DIR_PREFIX)) {
      continue;
    }

    const dirAbs = path.join(PROJECTS_ROOT, dirName);
    const sessionRepo = dirName.includes('BE-NEW') ? 'BE' : 'FE';

    for (const entry of fs.readdirSync(dirAbs, { recursive: true })) {
      if (!entry.endsWith('.jsonl')) {
        continue;
      }

      const isSub = entry.includes(`${path.sep}subagents${path.sep}`);

      if (!isSub && entry.includes(path.sep)) {
        continue;
      }

      result.push({ file: path.join(dirAbs, entry), isSub, sessionRepo });
    }
  }

  return result;
}

/**
 * 셸 명령을 따옴표·heredoc을 고려해 하위 명령(단어 배열) 목록으로 쪼갠다.
 * 커밋 메시지 본문이나 heredoc 안의 "git add" 같은 문자열을 명령으로 오인하지 않기 위함이다.
 */
export function splitShellCommand(command) {
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

    if (ch === '\\' && i + 1 < command.length) {
      word += command[++i];
      hasWord = true;
      continue;
    }

    if (ch === '<' && command[i + 1] === '<' && command[i + 2] !== '<') {
      const rest = command.slice(i + 2);
      const match = rest.match(/^-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);

      if (match) {
        const delimiter = match[2];
        const lineEnd = command.indexOf('\n', i);

        if (lineEnd === -1) {
          i = command.length;
          continue;
        }

        const bodyEnd = command
          .slice(lineEnd + 1)
          .search(new RegExp(`^\\s*${delimiter}\\s*$`, 'm'));
        const tail = command.slice(i + 2 + match[0].length, lineEnd);
        command =
          command.slice(0, i) +
          tail +
          (bodyEnd === -1
            ? ''
            : command.slice(lineEnd + 1 + bodyEnd).replace(new RegExp(`^\\s*${delimiter}`), ''));
        i -= 1;
        continue;
      }
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

/** 하위 명령의 앞쪽 환경변수 대입·래퍼(`env`, `command`, `timeout N`)를 벗긴다. */
function stripPrefix(words) {
  let index = 0;

  while (index < words.length) {
    const current = words[index];

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(current) || current === 'env' || current === 'command') {
      index += 1;
    } else if (current === 'timeout' && index + 1 < words.length) {
      index += 2;
    } else {
      break;
    }
  }

  return words.slice(index);
}

/** `git [-C dir] [-c k=v] <sub> args...`를 풀어 { dir, sub, args }로 돌려준다. git이 아니면 null. */
function parseGit(words) {
  if (words[0] !== 'git') {
    return null;
  }

  let dir = null;
  let index = 1;

  while (index < words.length && words[index].startsWith('-')) {
    if (words[index] === '-C') {
      dir = words[index + 1];
      index += 2;
    } else if (words[index] === '-c') {
      index += 2;
    } else {
      index += 1;
    }
  }

  return { dir, sub: words[index] ?? null, args: words.slice(index + 1) };
}

/** `git commit`에서 값을 받는 옵션(-m 등)이 `--` 뒤에 왔는지 — pathspec 오류의 인자 순서 원인. */
function hasOptionAfterDoubleDash(args) {
  const dashIndex = args.indexOf('--');

  if (dashIndex === -1) {
    return false;
  }

  return args
    .slice(dashIndex + 1)
    .some((arg) => COMMIT_OPTIONS_WITH_VALUE.has(arg) || /^--(message|file)=/.test(arg));
}

/** 명령 한 줄에서 (하위 명령, 그 명령이 실행될 디렉터리) 쌍을 만든다. `cd`와 `git -C`를 따라간다. */
function resolveSegments(command, cwd) {
  let current = cwd ?? '';
  const resolved = [];

  for (const raw of splitShellCommand(command)) {
    const words = stripPrefix(raw);

    if (words.length === 0) {
      continue;
    }

    if (words[0] === 'cd' && words[1]) {
      current = path.resolve(current || '/', words[1].replace(/^~/, os.homedir()));
      continue;
    }

    const git = parseGit(words);
    const dir = git?.dir ? path.resolve(current || '/', git.dir) : current;
    resolved.push({ words, git, dir });
  }

  return resolved;
}

function isWorktreePath(p) {
  return p.includes(WORKTREE_MARKER);
}

function toolResultText(block) {
  if (typeof block.content === 'string') {
    return block.content;
  }

  if (Array.isArray(block.content)) {
    return block.content.map((part) => (typeof part.text === 'string' ? part.text : '')).join('\n');
  }

  return '';
}

/** 코드·인라인 코드·URL·경로를 지운 뒤 글자 종류로 언어를 판정한다. */
export function classifyLanguage(text) {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S*[/\\]\S*/g, ' ');
  const hangul = (cleaned.match(/[가-힣]/g) ?? []).length;
  const kana = (cleaned.match(/[぀-ヿ]/g) ?? []).length;
  const latinWords = (cleaned.match(/[A-Za-z]{2,}/g) ?? []).length;

  if (kana > 0 && kana >= hangul) {
    return 'japanese';
  }

  if (hangul === 0 && latinWords >= 3) {
    return 'english';
  }

  if (hangul > 0) {
    return 'korean';
  }

  return 'other';
}

function isHumanPrompt(event) {
  if (event.type !== 'user' || event.isMeta || event.isCompactSummary) {
    return false;
  }

  const content = event.message?.content;

  if (typeof content === 'string') {
    return !content.startsWith('<');
  }

  return (
    Array.isArray(content) &&
    content.some((c) => c.type === 'text') &&
    !content.some((c) => c.type === 'tool_result')
  );
}

function createMetrics() {
  return {
    files: { main: 0, sub: 0 },
    seen: new Set(),
    m1: { total: 0, main: 0, worktree: 0, otherRepo: 0, broad: 0, explicit: 0, conflict: 0 },
    m2: { total: 0, argOrder: 0, untrackedNewFile: 0, other: 0 },
    m3: {
      stash: { main: 0, sub: 0 },
      resetHard: { main: 0, sub: 0 },
      checkoutAll: { main: 0, sub: 0 },
      afterRule: 0,
    },
    m4: { denials: { main: 0, sub: 0 }, turns: new Map(), bypass: 0 },
    m5: {
      byModel: new Map(),
      compacted: { before: { total: 0, english: 0 }, after: { total: 0, english: 0 } },
    },
    m10: { attempts: 0, succeeded: 0, ignoredLocal: 0, byDirection: {}, sessions: new Set() },
    m12: Object.fromEntries(HOOK_SCRIPTS.map((name) => [name, 0])),
  };
}

const ignoreCache = new Map();

/** 레포 메인 체크아웃 기준으로 gitignore된 경로인지(edit-guard가 허용하는 로컬 파일인지) 확인한다. */
function isGitIgnored(filePath, repoMatch) {
  const repoRoot = `${filePath.slice(0, repoMatch.index)}/link-sphere_${repoMatch[1]}_NEW`;
  const relative = path.relative(repoRoot, filePath);

  if (!ignoreCache.has(filePath)) {
    let ignored = false;

    try {
      execFileSync('git', ['-C', repoRoot, 'check-ignore', '-q', '--', relative], {
        stdio: 'ignore',
      });
      ignored = true;
    } catch {
      ignored = false;
    }

    ignoreCache.set(filePath, ignored);
  }

  return ignoreCache.get(filePath);
}

/** 이어하기·포크한 세션은 이전 이벤트를 다른 파일에 복제해 두므로, 처음 본 것만 센다. */
function isDuplicate(metrics, key) {
  if (!key) {
    return false;
  }

  if (metrics.seen.has(key)) {
    return true;
  }

  metrics.seen.add(key);

  return false;
}

function inRange(timestamp, options) {
  if (!timestamp) {
    return true;
  }

  const day = timestamp.slice(0, 10);

  return (!options.since || day >= options.since) && (!options.until || day <= options.until);
}

function recordGitAndRm(metrics, command, cwd, isSub, day, inConflict) {
  for (const { words, git, dir } of resolveSegments(command, cwd)) {
    if (git?.sub === 'add') {
      metrics.m1.total += 1;

      if (inConflict) {
        metrics.m1.conflict += 1;
      }

      if (isWorktreePath(dir)) {
        metrics.m1.worktree += 1;
      } else if (REPO_PATTERN.test(dir)) {
        metrics.m1.main += 1;
      } else {
        metrics.m1.otherRepo += 1;
      }

      if (git.args.some((arg) => BROAD_ADD_ARGS.has(arg))) {
        metrics.m1.broad += 1;
      } else {
        metrics.m1.explicit += 1;
      }
    }

    const bucket = isSub ? 'sub' : 'main';

    if (git?.sub === 'stash' && !['list', 'show'].includes(git.args[0])) {
      metrics.m3.stash[bucket] += 1;

      if (day >= RULE_DATES.sharedWorktreeStash) {
        metrics.m3.afterRule += 1;
      }
    }

    if (git?.sub === 'reset' && git.args.includes('--hard')) {
      metrics.m3.resetHard[bucket] += 1;
    }

    if (
      (git?.sub === 'checkout' && git.args[0] === '--' && git.args[1] === '.') ||
      (git?.sub === 'restore' && git.args.includes('.'))
    ) {
      metrics.m3.checkoutAll[bucket] += 1;
    }

    if (
      words[0] === 'unlink' ||
      words[0] === '/bin/rm' ||
      (words[0] === 'find' && words.includes('-delete'))
    ) {
      metrics.m4.bypass += 1;
    }
  }
}

function hasRmSegment(command, cwd) {
  return resolveSegments(command, cwd).some(({ words }) => words[0] === 'rm');
}

/** 훅 차단 기록의 `[<실행 명령>]` 부분에서 스크립트 파일명을 찾아 센다. */
function countHookFire(metrics, blockingText) {
  const header = blockingText.slice(0, blockingText.indexOf(']:') + 1);
  const script = HOOK_SCRIPTS.find((name) => header.includes(name));

  if (script) {
    metrics.m12[script] += 1;
  }
}

function processFile(metrics, { file, isSub, sessionRepo }, options) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const toolUses = new Map();
  let turn = 0;
  let compacted = false;
  let bashResults = 0;
  let lastConflictAt = -Infinity;
  let pendingPathspec = [];
  const hasCompaction = lines.some((line) => line.includes('"subtype":"compact_boundary"'));
  const sessionId = path.basename(file, '.jsonl');

  metrics.files[isSub ? 'sub' : 'main'] += 1;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    let event;

    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (event.type === 'system' && event.subtype === 'compact_boundary') {
      compacted = true;
      continue;
    }

    if (isHumanPrompt(event)) {
      turn += 1;
      continue;
    }

    if (!inRange(event.timestamp, options)) {
      continue;
    }

    const day = event.timestamp?.slice(0, 10) ?? '';

    if (isDuplicate(metrics, event.uuid)) {
      continue;
    }

    if (event.type === 'attachment' && event.attachment?.type === 'hook_blocking_error') {
      countHookFire(metrics, String(event.attachment.blockingError?.blockingError ?? ''));
      continue;
    }

    if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
      const model = event.message.model ?? 'unknown';

      for (const block of event.message.content) {
        if (block.type === 'text' && !isSub && model !== '<synthetic>' && block.text.trim()) {
          const lang = classifyLanguage(block.text);
          const stats = metrics.m5.byModel.get(model) ?? { total: 0, english: 0, japanese: 0 };
          stats.total += 1;
          stats.english += lang === 'english' ? 1 : 0;
          stats.japanese += lang === 'japanese' ? 1 : 0;
          metrics.m5.byModel.set(model, stats);

          if (hasCompaction) {
            const phase = compacted ? 'after' : 'before';
            metrics.m5.compacted[phase].total += 1;
            metrics.m5.compacted[phase].english += lang === 'english' ? 1 : 0;
          }

          const key = `${sessionId}#${turn}`;
          const turnState = metrics.m4.turns.get(key);

          if (
            turnState &&
            turnState.denials > 0 &&
            /```[\s\S]*?\brm\s[\s\S]*?```/.test(block.text)
          ) {
            turnState.presented = true;
          }
        }

        if (block.type !== 'tool_use' || isDuplicate(metrics, block.id)) {
          continue;
        }

        toolUses.set(block.id, { name: block.name, input: block.input ?? {}, cwd: event.cwd });

        if (block.name === 'Bash' && typeof block.input?.command === 'string') {
          const inConflict = bashResults - lastConflictAt <= CONFLICT_WINDOW;
          recordGitAndRm(metrics, block.input.command, event.cwd, isSub, day, inConflict);
        }

        const filePath = block.input?.file_path ?? block.input?.notebook_path;

        if (
          ['Edit', 'Write', 'NotebookEdit', 'MultiEdit'].includes(block.name) &&
          typeof filePath === 'string'
        ) {
          const repoMatch = filePath.match(REPO_PATTERN);

          if (repoMatch && !isWorktreePath(filePath) && isGitIgnored(filePath, repoMatch)) {
            metrics.m10.ignoredLocal += 1;
          } else if (repoMatch && !isWorktreePath(filePath)) {
            const direction = `${sessionRepo} 세션 → ${repoMatch[1]} 파일`;
            metrics.m10.attempts += 1;
            metrics.m10.byDirection[direction] = (metrics.m10.byDirection[direction] ?? 0) + 1;
            metrics.m10.sessions.add(sessionId);
            toolUses.get(block.id).mainCheckoutEdit = true;
          }
        }
      }
    }

    if (event.type === 'user' && Array.isArray(event.message?.content)) {
      for (const block of event.message.content) {
        if (block.type !== 'tool_result' || isDuplicate(metrics, `result:${block.tool_use_id}`)) {
          continue;
        }

        const use = toolUses.get(block.tool_use_id);
        const text = toolResultText(block);

        if (PRE_TOOL_HOOK_ERROR.test(text)) {
          countHookFire(metrics, text);
        }

        if (use?.mainCheckoutEdit && !block.is_error) {
          metrics.m10.succeeded += 1;
        }

        if (!use || use.name !== 'Bash' || typeof use.input.command !== 'string') {
          continue;
        }

        bashResults += 1;

        if (CONFLICT_SIGNAL.test(text)) {
          lastConflictAt = bashResults;
        }

        if (text.includes('create mode')) {
          metrics.m2.untrackedNewFile += pendingPathspec.length;
          pendingPathspec = [];
        }

        const expired = pendingPathspec.filter((deadline) => deadline < bashResults);
        metrics.m2.other += expired.length;
        pendingPathspec = pendingPathspec.filter((deadline) => deadline >= bashResults);

        if (text.includes(PATHSPEC_ERROR)) {
          metrics.m2.total += 1;
          const commitArgs =
            resolveSegments(use.input.command, use.cwd).find(({ git }) => git?.sub === 'commit')
              ?.git.args ?? [];

          if (hasOptionAfterDoubleDash(commitArgs)) {
            metrics.m2.argOrder += 1;
          } else {
            pendingPathspec.push(bashResults + PATHSPEC_FOLLOWUP_WINDOW);
          }
        }

        const blocked =
          DENIAL_PATTERN.test(text) ||
          (PRE_TOOL_HOOK_ERROR.test(text) && text.includes('bash-guard.sh'));

        if (blocked && hasRmSegment(use.input.command, use.cwd)) {
          metrics.m4.denials[isSub ? 'sub' : 'main'] += 1;
          const key = `${sessionId}#${turn}`;
          const turnState = metrics.m4.turns.get(key) ?? {
            denials: 0,
            presented: false,
            day,
            isSub,
          };
          turnState.denials += 1;
          metrics.m4.turns.set(key, turnState);
        }
      }
    }
  }

  metrics.m2.other += pendingPathspec.length;
}

function summarize(metrics) {
  const rmTurns = [...metrics.m4.turns.values()].filter((t) => !t.isSub);
  const splitRm = (predicate) => {
    const turns = rmTurns.filter(predicate);
    const retried = turns.filter((t) => t.denials >= 2).length;
    const presented = turns.filter((t) => t.presented).length;

    return { turns: turns.length, retried, presented };
  };
  const models = [...metrics.m5.byModel.entries()]
    .map(([model, s]) => ({ model, ...s, englishRate: s.total ? s.english / s.total : 0 }))
    .sort((a, b) => b.total - a.total);
  const mainTotal = models.reduce((sum, m) => sum + m.total, 0);
  const mainEnglish = models.reduce((sum, m) => sum + m.english, 0);

  return {
    files: metrics.files,
    m1_gitAdd: metrics.m1,
    m2_pathspec: metrics.m2,
    m3_destructive: metrics.m3,
    m4_rm: {
      denials: metrics.m4.denials,
      beforeMemory: splitRm((t) => t.day < RULE_DATES.rmMemory),
      afterMemory: splitRm((t) => t.day >= RULE_DATES.rmMemory),
      bypassAttempts: metrics.m4.bypass,
    },
    m5_language: {
      mainBlocks: mainTotal,
      englishRate: mainTotal ? mainEnglish / mainTotal : 0,
      byModel: models,
      compactedSessions: metrics.m5.compacted,
    },
    m10_mainCheckoutEdits: {
      attempts: metrics.m10.attempts,
      succeeded: metrics.m10.succeeded,
      ignoredLocalExcluded: metrics.m10.ignoredLocal,
      byDirection: metrics.m10.byDirection,
      sessions: [...metrics.m10.sessions],
    },
    m12_hookFires: metrics.m12,
  };
}

function percent(n, d) {
  return d ? `${((n / d) * 100).toFixed(1)}%` : '-';
}

function printMarkdown(summary, options) {
  const s = summary;
  const range = `${options.since ?? '처음'} ~ ${options.until ?? '끝'} (UTC)`;
  const rmRow = (label, r) =>
    `| ${label} | ${r.turns} | ${r.retried} (${percent(r.retried, r.turns)}) | ${r.presented} (${percent(r.presented, r.turns)}) |`;

  console.log(`## 규칙 위반 측정 — ${range}`);
  console.log(`\n트랜스크립트: 메인 ${s.files.main}개, 서브에이전트 ${s.files.sub}개\n`);
  console.log('| 지표 | 값 |');
  console.log('| --- | --- |');
  console.log(
    `| M1 git add | ${s.m1_gitAdd.total} (link-sphere 메인 체크아웃 ${s.m1_gitAdd.main} / 워크트리 ${s.m1_gitAdd.worktree} / 그 밖의 레포 ${s.m1_gitAdd.otherRepo}, 광범위 ${s.m1_gitAdd.broad}, 충돌 해결 중 ${s.m1_gitAdd.conflict}) |`
  );
  console.log(
    `| M2 pathspec 오류 | ${s.m2_pathspec.total} (인자 순서 ${s.m2_pathspec.argOrder} / 새 파일 ${s.m2_pathspec.untrackedNewFile} / 그 외 ${s.m2_pathspec.other}) |`
  );
  console.log(
    `| M3 stash / reset --hard / checkout -- . | 메인 ${s.m3_destructive.stash.main}·${s.m3_destructive.resetHard.main}·${s.m3_destructive.checkoutAll.main} / 서브 ${s.m3_destructive.stash.sub}·${s.m3_destructive.resetHard.sub}·${s.m3_destructive.checkoutAll.sub} (stash 중 ${RULE_DATES.sharedWorktreeStash} 이후 ${s.m3_destructive.afterRule}) |`
  );
  console.log(
    `| M4 rm 거부 | 메인 ${s.m4_rm.denials.main} / 서브 ${s.m4_rm.denials.sub}, 우회형 시도 ${s.m4_rm.bypassAttempts} |`
  );
  console.log(
    `| M5 메인 스레드 영어 블록 | ${percent(s.m5_language.englishRate * s.m5_language.mainBlocks, s.m5_language.mainBlocks)} (${s.m5_language.mainBlocks}블록) |`
  );
  console.log(
    `| M5 압축 세션 영어 | 압축 전 ${percent(s.m5_language.compactedSessions.before.english, s.m5_language.compactedSessions.before.total)} → 압축 후 ${percent(s.m5_language.compactedSessions.after.english, s.m5_language.compactedSessions.after.total)} |`
  );
  console.log(
    `| M10 메인 체크아웃 Edit/Write(gitignore 파일 ${s.m10_mainCheckoutEdits.ignoredLocalExcluded}건 제외) | 시도 ${s.m10_mainCheckoutEdits.attempts} / 성공 ${s.m10_mainCheckoutEdits.succeeded} (${Object.entries(
      s.m10_mainCheckoutEdits.byDirection
    )
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}) |`
  );
  console.log(
    `| M12 훅 발동 | ${Object.entries(s.m12_hookFires)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')} |`
  );

  console.log('\n### M4 rm 거부가 있었던 턴(메인 스레드)\n');
  console.log('| 구간 | 턴 | 같은 턴 재시도 | rm 코드블록 제시 |');
  console.log('| --- | --- | --- | --- |');
  console.log(rmRow(`${RULE_DATES.rmMemory} 이전`, s.m4_rm.beforeMemory));
  console.log(rmRow(`${RULE_DATES.rmMemory} 이후`, s.m4_rm.afterMemory));

  console.log('\n### M5 모델별 영어 블록\n');
  console.log('| 모델 | 블록 | 영어 | 일본어 |');
  console.log('| --- | --- | --- | --- |');

  for (const m of s.m5_language.byModel) {
    console.log(`| ${m.model} | ${m.total} | ${percent(m.english, m.total)} | ${m.japanese} |`);
  }

  if (s.m10_mainCheckoutEdits.sessions.length > 0) {
    console.log(`\nM10 세션: ${s.m10_mainCheckoutEdits.sessions.join(', ')}`);
  }
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isEntrypoint) {
  const options = parseArgs(process.argv.slice(2));
  const metrics = createMetrics();

  for (const transcript of collectTranscripts()) {
    processFile(metrics, transcript, options);
  }

  const summary = summarize(metrics);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printMarkdown(summary, options);
  }
}
