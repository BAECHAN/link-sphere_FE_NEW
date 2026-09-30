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

import {
  broadAddArg,
  destructiveKind,
  hasOptionAfterDoubleDash,
  isWorktreePath,
  REPO_PATTERN,
  repoOf,
  resolveSegments,
} from '../lib/shell-parse.mjs';

const PROJECTS_ROOT = path.join(os.homedir(), '.claude', 'projects');
const PROJECT_DIR_PREFIX = '-Users-baechan-project-link-sphere-link-sphere-';

// 규칙·메모리가 생긴 날짜. 이 날짜 전후로 나눠 보고한다.
const RULE_DATES = {
  rmMemory: '2026-09-11',
  sharedWorktreeStash: '2026-09-27',
};

// 발동 횟수(M12)를 셀 훅 스크립트. 트랜스크립트에는 훅이 막은 기록이 `[<실행 명령>]: <stderr>`
// 형태로 남으므로(PostToolUse는 attachment `hook_blocking_error`, PreToolUse는 tool_result의
// `PreToolUse:<도구> hook error:`) 명령 안의 스크립트 파일명으로 구분한다. 문구로 세면 훅
// 스크립트나 문서를 Read한 기록까지 잡힌다.
// filename-case-check.sh는 2026-09-30 .mjs로 옮겼다 — 과거 기록을 세려고 옛 이름도 둔다.
const HOOK_SCRIPTS = [
  'plan-diagram-reminder.sh',
  'filename-case-check.sh',
  'filename-case-check.mjs',
  'bash-guard.mjs',
  'edit-guard.mjs',
  'deploy-verify.mjs',
];
const PRE_TOOL_HOOK_ERROR = /^PreToolUse:\w+ hook error: \[/;
// asyncRewake 훅(deploy-verify.mjs)이 세션을 깨운 기록은 실행 명령 없이 이벤트 이름만 남는다(2026-09-30
// 스파이크): user 메시지 `… Stop hook blocking error from command "PostToolUse:Bash": <stderr>`. 그래서
// stderr 첫머리 표식으로 스크립트를 가린다.
const REWAKE_ERROR =
  /Stop hook blocking error from command "PostToolUse(?:Failure)?:\w+": \[deploy-verify\]/;

// M5 세션 단위 비율은 중간 서술이 이만큼 이상인 세션만 쓴다(블록이 몇 세션에 몰려 있어서다).
const SESSION_MIN_BLOCKS = 20;

const PATHSPEC_ERROR = 'did not match any file(s) known to git';
// pathspec 오류 뒤 이만큼의 Bash 결과 안에 `create mode`(새 파일 커밋)가 나오면 새 파일이 원인이었다고 본다.
const PATHSPEC_FOLLOWUP_WINDOW = 4;
// git add 직전 이만큼의 Bash 결과 안에 충돌 신호가 있으면 충돌 해결 중 add로 본다.
const CONFLICT_WINDOW = 10;
const CONFLICT_SIGNAL = /CONFLICT \(|Merge conflict|could not apply|fix conflicts/i;
const DENIAL_PATTERN = /^Permission to use Bash with command [\s\S]* has been denied/;

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

function stripCode(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}

/** 코드 밖의 `~~취소선~~`이 있는지(M13). */
export function hasStrikethrough(text) {
  return /~~[^~\s][^~\n]*~~/.test(stripCode(text));
}

/** 원문 인용을 번역과 나란히 실었는지(M13): `(번역: …)` 또는 따옴표 안 영어 문장 바로 뒤의 한국어 괄호. */
export function hasTranslationPair(text) {
  const cleaned = stripCode(text);

  return (
    /\(번역:/.test(cleaned) ||
    /["“][A-Za-z][^"”\n]{15,}["”]_?\s*\([^)\n]*[가-힣][^)\n]*\)/.test(cleaned)
  );
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

function newLanguageStats() {
  return {
    total: 0,
    english: 0,
    japanese: 0,
    final: { total: 0, english: 0 },
    intermediate: { total: 0, english: 0 },
  };
}

function addLanguage(stats, kind, lang) {
  const english = lang === 'english' ? 1 : 0;
  stats.total += 1;
  stats.english += english;
  stats.japanese += lang === 'japanese' ? 1 : 0;
  stats[kind].total += 1;
  stats[kind].english += english;
}

/**
 * 확정된 메인 스레드 text 블록 하나를 M5·M13에 넣는다. kind는 'final'(턴을 닫는 답변) 또는
 * 'intermediate'(뒤에 도구 호출·다른 text가 이어진 서술).
 */
function recordReply(metrics, reply, kind) {
  if (!reply.countable) {
    return;
  }

  const lang = classifyLanguage(reply.text);
  const byModel = metrics.m5.byModel.get(reply.model) ?? newLanguageStats();
  addLanguage(byModel, kind, lang);
  metrics.m5.byModel.set(reply.model, byModel);

  if (reply.phase) {
    addLanguage(metrics.m5.compacted[reply.phase], kind, lang);
  }

  if (kind === 'intermediate') {
    const key = `${reply.model}\u0000${reply.sessionId}`;
    const session = metrics.m5.sessions.get(key) ?? {
      model: reply.model,
      total: 0,
      english: 0,
      before: { total: 0, english: 0 },
      after: { total: 0, english: 0 },
    };
    const english = lang === 'english' ? 1 : 0;
    session.total += 1;
    session.english += english;

    // 압축을 겪은 세션은 압축 전후를 따로 센다 — 언어 실험 2단계(압축 후 주입) 판정용.
    if (reply.phase) {
      session[reply.phase].total += 1;
      session[reply.phase].english += english;
    }

    metrics.m5.sessions.set(key, session);

    return;
  }

  metrics.m13.finalBlocks += 1;
  metrics.m13.strikethrough += hasStrikethrough(reply.text) ? 1 : 0;
  metrics.m13.translationPair += hasTranslationPair(reply.text) ? 1 : 0;
}

function createMetrics() {
  return {
    files: { main: 0, sub: 0 },
    seen: new Set(),
    m1: { total: 0, main: 0, worktree: 0, otherRepo: 0, broad: 0, explicit: 0, conflict: 0 },
    m2: { total: 0, argOrder: 0, untrackedNewFile: 0, other: 0 },
    m3: { byKind: {}, stashAfterRule: 0 },
    guard: { executed: {}, blocked: {} },
    m4: { denials: { main: 0, sub: 0 }, turns: new Map(), bypass: 0 },
    m5: {
      byModel: new Map(),
      compacted: { before: newLanguageStats(), after: newLanguageStats() },
      sessions: new Map(),
    },
    m13: { finalBlocks: 0, strikethrough: 0, translationPair: 0 },
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

/**
 * M1·M3·우회형을 센다. git 규칙은 가드(bash-guard.mjs)와 같은 범위(link-sphere 레포)·같은 판정
 * 함수로 센다. 반환한 가드 대상 범주는 도구 결과를 볼 때 "실행됨/막힘"으로 나눠 센다.
 */
function recordGitAndRm(metrics, command, cwd, isSub, day, inConflict) {
  const categories = [];
  const bucket = isSub ? 'sub' : 'main';

  for (const { words, git, dir } of resolveSegments(command, cwd)) {
    if (
      words[0] === 'unlink' ||
      words[0] === '/bin/rm' ||
      (words[0] === 'find' && words.includes('-delete'))
    ) {
      metrics.m4.bypass += 1;
    }

    if (!git?.sub) {
      continue;
    }

    const linkSphere = Boolean(repoOf(dir));

    if (git.sub === 'add') {
      metrics.m1.total += 1;

      if (inConflict) {
        metrics.m1.conflict += 1;
      }

      if (!linkSphere) {
        metrics.m1.otherRepo += 1;
        continue;
      }

      if (isWorktreePath(dir)) {
        metrics.m1.worktree += 1;
      } else {
        metrics.m1.main += 1;
        categories.push('add:main');
      }

      if (broadAddArg(git.args)) {
        metrics.m1.broad += 1;
        categories.push('add:broad');
      } else {
        metrics.m1.explicit += 1;
      }

      continue;
    }

    const kind = linkSphere ? destructiveKind(git) : null;

    if (kind) {
      metrics.m3.byKind[kind] = metrics.m3.byKind[kind] ?? { main: 0, sub: 0 };
      metrics.m3.byKind[kind][bucket] += 1;

      if (kind === 'stash' && day >= RULE_DATES.sharedWorktreeStash) {
        metrics.m3.stashAfterRule += 1;
      }

      categories.push(kind === 'stash' ? `stash:${bucket}` : 'destructive');
    }
  }

  return categories;
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
  // M5·M13: 메인 스레드 text 블록을 보류해 두었다가 뒤에 text·tool_use가 오면 중간 서술, 턴 경계(tool_result·
  // meta가 아닌 user 이벤트 — 사람 프롬프트·작업 알림·훅 깨움 — 압축 경계, 파일 끝)를 만나면 최종 답변으로
  // 확정한다. 경계 판정은 기간 밖·중복 이벤트로도 하고, 집계만 뺀다(countable).
  let pendingReply = null;
  const settleReply = (kind) => {
    if (pendingReply) {
      recordReply(metrics, pendingReply, kind);
      pendingReply = null;
    }
  };
  const trackReply = (event) => {
    // isMeta user 이벤트(skill 본문·명령 안내처럼 하네스가 턴 중간에 끼워 넣는 것)는 새 턴이 아니라 경계에서 뺀다.
    if (event.type === 'user') {
      const content = event.message?.content;
      const toolResult = Array.isArray(content) && content.some((c) => c.type === 'tool_result');

      if (!toolResult && !event.isMeta) {
        settleReply('final');
      }

      return;
    }

    if (event.type !== 'assistant' || !Array.isArray(event.message?.content)) {
      return;
    }

    const model = event.message.model ?? 'unknown';
    const countable =
      inRange(event.timestamp, options) && !(event.uuid && metrics.seen.has(event.uuid));

    for (const block of event.message.content) {
      if (block.type === 'tool_use') {
        settleReply('intermediate');
      } else if (block.type === 'text' && model !== '<synthetic>' && block.text.trim()) {
        settleReply('intermediate');
        pendingReply = {
          model,
          text: block.text,
          countable,
          sessionId,
          phase: hasCompaction ? (compacted ? 'after' : 'before') : null,
        };
      }
    }
  };

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
      settleReply('final');
      compacted = true;
      continue;
    }

    if (!isSub) {
      trackReply(event);
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

    if (
      event.type === 'user' &&
      typeof event.message?.content === 'string' &&
      REWAKE_ERROR.test(event.message.content)
    ) {
      metrics.m12['deploy-verify.mjs'] += 1;
    }

    if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
      const model = event.message.model ?? 'unknown';

      for (const block of event.message.content) {
        if (block.type === 'text' && !isSub && model !== '<synthetic>' && block.text.trim()) {
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
          toolUses.get(block.id).categories = recordGitAndRm(
            metrics,
            block.input.command,
            event.cwd,
            isSub,
            day,
            inConflict
          );
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

        // 가드 대상 범주를 "실행됨/막힘"으로 나눈다 — 막힘은 가드 차단, 권한 거부, ask에서 사용자가 거절한 경우.
        const blockedBeforeRun =
          DENIAL_PATTERN.test(text) ||
          (PRE_TOOL_HOOK_ERROR.test(text) && text.includes('bash-guard.mjs'));

        for (const category of use.categories ?? []) {
          const target = blockedBeforeRun ? metrics.guard.blocked : metrics.guard.executed;
          target[category] = (target[category] ?? 0) + 1;
        }

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
          (PRE_TOOL_HOOK_ERROR.test(text) && text.includes('bash-guard.mjs'));

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
  settleReply('final');
}

/** 정렬 뒤 가장 가까운 순위의 값(p는 0~1). 값이 없으면 null. */
function quantile(values, p) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function summarize(metrics) {
  const rmTurns = [...metrics.m4.turns.values()].filter((t) => !t.isSub);
  const splitRm = (predicate) => {
    const turns = rmTurns.filter(predicate);
    const retried = turns.filter((t) => t.denials >= 2).length;
    const presented = turns.filter((t) => t.presented).length;

    return { turns: turns.length, retried, presented };
  };
  // 언어 실험 판정 지표(2026-09-30 사용자 결정): 모델별로, 중간 서술이 SESSION_MIN_BLOCKS 이상인 세션 중
  // "영어로 흐른 세션"(중간 서술의 DRIFT_RATE 이상이 영어)의 비율. 분포가 양봉(대부분 거의 0%, 일부가
  // 30~70%)이라 중앙값·블록 합계보다 이 비율이 효과를 가른다(docs/plans/2026-09-30-rule-enforcement-phase3.md).
  const DRIFT_RATE = 0.1;
  const rateOf = (s) => (s.total ? s.english / s.total : 0);
  const sessionsByModel = new Map();

  for (const session of metrics.m5.sessions.values()) {
    if (session.total >= SESSION_MIN_BLOCKS) {
      const list = sessionsByModel.get(session.model) ?? [];
      list.push(session);
      sessionsByModel.set(session.model, list);
    }
  }

  const models = [...metrics.m5.byModel.entries()]
    .map(([model, s]) => {
      const sessions = sessionsByModel.get(model) ?? [];
      const rates = sessions.map(rateOf);
      const drifted = sessions.filter((session) => rateOf(session) >= DRIFT_RATE);
      const driftedCompacted = drifted.filter((session) => session.after.total > 0);

      return {
        model,
        ...s,
        englishRate: s.total ? s.english / s.total : 0,
        sessions: sessions.length,
        sessionIntermediate: {
          p50: quantile(rates, 0.5),
          p75: quantile(rates, 0.75),
          p90: quantile(rates, 0.9),
          drifted: drifted.length,
          driftedCompacted: driftedCompacted.length,
          // 압축 전에는 한국어였다가 압축 뒤에 흐른 세션 — 2단계(압축 후 주입) 판정용
          driftedAfterCompactionOnly: driftedCompacted.filter(
            (session) => rateOf(session.before) < DRIFT_RATE && rateOf(session.after) >= DRIFT_RATE
          ).length,
        },
      };
    })
    .sort((a, b) => b.total - a.total);
  const mainTotal = models.reduce((sum, m) => sum + m.total, 0);
  const mainEnglish = models.reduce((sum, m) => sum + m.english, 0);

  return {
    files: metrics.files,
    m1_gitAdd: metrics.m1,
    m2_pathspec: metrics.m2,
    m3_destructive: metrics.m3,
    guard_categories: metrics.guard,
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
    m13_finalReplyFormat: metrics.m13,
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
    `| M1 git add | ${s.m1_gitAdd.total} (link-sphere 메인 체크아웃 ${s.m1_gitAdd.main} / 워크트리 ${s.m1_gitAdd.worktree} / 그 밖의 레포 ${s.m1_gitAdd.otherRepo}, link-sphere 광범위 ${s.m1_gitAdd.broad}, 충돌 해결 중 ${s.m1_gitAdd.conflict}) |`
  );
  const categoryRow = (name) =>
    `${name} 실행 ${s.guard_categories.executed[name] ?? 0}·막힘 ${s.guard_categories.blocked[name] ?? 0}`;
  console.log(
    `| 가드 대상(실행/막힘) | ${['add:main', 'add:broad', 'stash:main', 'stash:sub', 'destructive'].map(categoryRow).join(', ')} |`
  );
  console.log(
    `| M2 pathspec 오류 | ${s.m2_pathspec.total} (인자 순서 ${s.m2_pathspec.argOrder} / 새 파일 ${s.m2_pathspec.untrackedNewFile} / 그 외 ${s.m2_pathspec.other}) |`
  );
  console.log(
    `| M3 되돌리기 어려운 git 명령(link-sphere) | ${
      Object.entries(s.m3_destructive.byKind)
        .map(([kind, n]) => `${kind} 메인 ${n.main}·서브 ${n.sub}`)
        .join(', ') || '없음'
    } (stash 중 ${RULE_DATES.sharedWorktreeStash} 이후 ${s.m3_destructive.stashAfterRule}) |`
  );
  console.log(
    `| M4 rm 거부 | 메인 ${s.m4_rm.denials.main} / 서브 ${s.m4_rm.denials.sub}, 우회형 시도 ${s.m4_rm.bypassAttempts} |`
  );
  console.log(
    `| M5 메인 스레드 영어 블록 | ${percent(s.m5_language.englishRate * s.m5_language.mainBlocks, s.m5_language.mainBlocks)} (${s.m5_language.mainBlocks}블록) |`
  );
  const { before, after } = s.m5_language.compactedSessions;
  console.log(
    `| M5 압축 세션 영어 | 압축 전 ${percent(before.english, before.total)} → 압축 후 ${percent(after.english, after.total)} (중간 서술 ${percent(before.intermediate.english, before.intermediate.total)} → ${percent(after.intermediate.english, after.intermediate.total)}, 최종 답변 ${percent(before.final.english, before.final.total)} → ${percent(after.final.english, after.final.total)}) |`
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
  const m13 = s.m13_finalReplyFormat;
  console.log(
    `| M13 최종 답변 형식(메인 스레드) | ${m13.finalBlocks}블록 중 취소선 ${m13.strikethrough}, 원문+번역 병기 ${m13.translationPair} |`
  );

  console.log('\n### M4 rm 거부가 있었던 턴(메인 스레드)\n');
  console.log('| 구간 | 턴 | 같은 턴 재시도 | rm 코드블록 제시 |');
  console.log('| --- | --- | --- | --- |');
  console.log(rmRow(`${RULE_DATES.rmMemory} 이전`, s.m4_rm.beforeMemory));
  console.log(rmRow(`${RULE_DATES.rmMemory} 이후`, s.m4_rm.afterMemory));

  console.log('\n### M5 모델별 영어 블록\n');
  console.log(
    `| 모델 | 블록 | 영어 | 일본어 | 최종 답변 영어 | 중간 서술 영어 | 세션 수(중간 ${SESSION_MIN_BLOCKS}블록+) | 세션별 중간 서술 영어 p50/p75/p90 | 영어로 흐른 세션(10%+) | 그중 압축 세션 / 압축 뒤에만 흐름 |`
  );
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const m of s.m5_language.byModel) {
    const q = m.sessionIntermediate;
    const quantiles =
      q.p50 === null ? '-' : [q.p50, q.p75, q.p90].map((v) => percent(v, 1)).join(' / ');
    console.log(
      `| ${m.model} | ${m.total} | ${percent(m.english, m.total)} | ${m.japanese} | ${m.final.english}/${m.final.total} (${percent(m.final.english, m.final.total)}) | ${percent(m.intermediate.english, m.intermediate.total)} | ${m.sessions} | ${quantiles} | ${q.drifted} (${percent(q.drifted, m.sessions)}) | ${q.driftedCompacted} / ${q.driftedAfterCompactionOnly} |`
    );
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
