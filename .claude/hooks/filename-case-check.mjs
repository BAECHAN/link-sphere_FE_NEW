// PostToolUse(Write) 훅 — 새로 만든 .ts/.tsx 파일이 eslint.config.js의 unicorn/filename-case 규칙(atoms·
// 컴포넌트·훅·utils·api·queries·types·schema·config 전부 커버)을 어기면 그 자리에서 알린다.
//
// 배경: 2026-09-22, queryClient↔auth.util 순환 의존을 고치며 상태를 분리한 유틸 파일을 logoutGrace.util.ts
// (camelCase)로 먼저 만들었다가 사용자 지적으로 뒤늦게 kebab-case로 고쳤다. 규칙은 이미 있었지만 lint를
// 돌리기 *전에* 이름을 스스로 정정해버려서 규칙이 개입할 기회가 없었다. 파일 생성 직후 그 파일 하나만 검사한다.
//
// 2026-09-30 filename-case-check.sh에서 옮겼다. 설치 후 발동이 0회였는데 원인은 둘이었다(직접 측정 —
// 설치 후 FE src/의 .ts/.tsx Write 65건, docs/plans/2026-09-30-rule-enforcement-phase3.md):
//   - 33건: FE 메인에서 시작한 세션이 워크트리에 쓴 것. $CLAUDE_PROJECT_DIR가 세션을 시작한 메인 체크아웃에
//     머물러(hooks 문서) "${project_dir}/src/" 비교에서 워크트리 경로가 빠졌다.
//   - 27건: BE 세션이 FE 워크트리에 쓴 것. FE 프로젝트 settings 자체가 로드되지 않았다.
// 그래서 사용자 설정에 등록하고(모든 프로젝트의 Write마다 돈다) 경로 문자열로 먼저 거른 뒤, 파일이 속한
// 워크트리(또는 메인 체크아웃)의 eslint를 node로 직접 실행한다(PATH의 pnpm·jq에 기대지 않는다).
// Write에만 건다 — 파일명은 생성 시점에만 정해진다. 실패하면 통과시킨다(fail-open). 실행은 run-node.sh.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { repoOf, worktreeRootOf } from '../lib/shell-parse.mjs';

const ESLINT_BIN = path.join('node_modules', 'eslint', 'bin', 'eslint.js');

/**
 * Write 대상 하나를 검사할지 정한다. 순수 함수라 테스트에 그대로 쓴다.
 * @returns {null | { absPath: string, root: string, eslintBin: string }}
 */
export function decideFilenameCheck({ filePath, cwd }, exists = fs.existsSync) {
  if (typeof filePath !== 'string' || !/\.tsx?$/.test(filePath)) {
    return null;
  }

  const absPath = path.resolve(cwd || '/', filePath);
  const repo = repoOf(absPath);

  if (!repo || repo.repo !== 'FE') {
    return null;
  }

  const root = worktreeRootOf(absPath) ?? repo.mainRoot;
  const eslintBin = path.join(root, ESLINT_BIN);

  if (!absPath.startsWith(`${root}/src/`) || !exists(absPath) || !exists(eslintBin)) {
    return null;
  }

  return { absPath, root, eslintBin };
}

/** eslint --format json 출력에서 unicorn/filename-case 위반 메시지를 찾는다. 없으면 null. */
export function findViolation(eslintJson) {
  let results;

  try {
    results = JSON.parse(eslintJson);
  } catch {
    return null;
  }

  for (const result of Array.isArray(results) ? results : []) {
    const hit = (result.messages ?? []).find((m) => m.ruleId === 'unicorn/filename-case');

    if (hit) {
      return hit.message;
    }
  }

  return null;
}

function main() {
  let payload;

  try {
    payload = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }

  const target = decideFilenameCheck({
    filePath: payload?.tool_input?.file_path,
    cwd: payload?.cwd ?? process.cwd(),
  });

  if (!target) {
    process.exit(0);
  }

  const lint = spawnSync(process.execPath, [target.eslintBin, '--format', 'json', target.absPath], {
    cwd: target.root,
    encoding: 'utf8',
    timeout: 20_000,
  });
  const message = findViolation(lint.stdout ?? '');

  if (!message) {
    process.exit(0);
  }

  process.stderr.write(
    '[docs/FE-ARCHITECTURE.md §18 네이밍 컨벤션] 방금 만든 파일이 파일명 규칙을 어깁니다.\n' +
      `  ${target.absPath}\n` +
      `  ${message}\n` +
      'lint 실행을 기다리지 말고 지금 바로 이름을 고치세요.\n'
  );
  process.exit(2);
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
