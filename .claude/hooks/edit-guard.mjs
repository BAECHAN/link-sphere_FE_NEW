// PreToolUse(Edit|Write|NotebookEdit) 가드 — link-sphere FE·BE의 메인 체크아웃 파일을 직접
// 편집하지 못하게 막는다(CLAUDE.md "워크트리 없이 코드 수정 금지"). BE에서 시작한 세션이 FE 메인
// 체크아웃 파일을 57번 Edit/Write하려 한 것이 계기다 — BE 세션에는 FE CLAUDE.md가 로드되지 않아 문서
// 규칙이 닿지 않았다(docs/plans/2026-09-29-rule-enforcement-hardening.md Phase 2). 직접 측정 —
// `node .claude/scripts/rule-metrics.mjs --since 2026-08-31 --until 2026-09-29`의 M10(2026-09-30 실행).
// 계획 파일의 26회는 측정기를 만들기 전의 1차 조사값이다.
// 사용자 설정에 등록해 어느 레포 세션에서든 동작한다. 실행은 run-node.sh가 맡는다.
//
// 허용: 워크트리(.claude/worktrees/) 안의 파일, gitignore된 로컬 파일(.claude/settings.local.json
// 등, 2026-09-29 사용자 결정), link-sphere 밖의 파일. 판정에 실패하면 통과시킨다(fail-open).
// 정직한 한계: 경로를 문자열로 비교하므로 대소문자만 바꾼 경로나 심볼릭 링크 별칭으로 들어오면 못 본다.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { isWorktreePath, repoOf, sessionAdvice } from '../lib/shell-parse.mjs';

/** 메인 체크아웃 기준 gitignore 여부. true/false, 판정 실패는 null. */
function realIsIgnored(repoRoot, relativePath) {
  try {
    execFileSync('git', ['-C', repoRoot, 'check-ignore', '-q', '--', relativePath], {
      stdio: 'ignore',
      timeout: 3000,
    });

    return true;
  } catch (error) {
    return error.status === 1 ? false : null;
  }
}

/**
 * 편집 대상 경로 하나에 대한 판정. 순수 함수라 테스트에 그대로 쓴다.
 * @returns {{ action: 'allow' } | { action: 'deny', reason: string }}
 */
export function decideEdit({ filePath, cwd }, isIgnored = realIsIgnored) {
  if (typeof filePath !== 'string' || filePath === '') {
    return { action: 'allow' };
  }

  const absPath = path.resolve(cwd || '/', filePath);
  const target = repoOf(absPath);

  if (!target || isWorktreePath(absPath)) {
    return { action: 'allow' };
  }

  const relative = path.relative(target.mainRoot, absPath);

  if (isIgnored(target.mainRoot, relative) !== false) {
    return { action: 'allow' };
  }

  return {
    action: 'deny',
    reason:
      `[edit-guard] ${absPath}는 link-sphere ${target.repo} 메인 체크아웃의 파일이다. 메인 체크아웃은 여러 세션이 ` +
      '공유해 서로의 변경을 덮어쓰므로 직접 편집하지 않는다(.claude/CLAUDE.md "워크트리 없이 코드 수정" 규칙).\n' +
      sessionAdvice({ repo: target.repo, sessionCwd: cwd, relative }),
  };
}

function main() {
  let payload;

  try {
    payload = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }

  const input = payload?.tool_input ?? {};
  let result;

  try {
    result = decideEdit({
      filePath: input.file_path ?? input.notebook_path,
      cwd: payload.cwd ?? process.cwd(),
    });
  } catch {
    process.exit(0);
  }

  if (result.action === 'deny') {
    process.stderr.write(`${result.reason}\n`);
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
  main();
}
