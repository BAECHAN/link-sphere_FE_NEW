// filename-case-check 훅 회귀 테스트. 실행: node --test .claude/hooks/filename-case-check.test.mjs
// 임시 디렉터리에 link-sphere_FE_NEW 메인·워크트리 모양을 만들고, 진짜 eslint 대신 위반 JSON을 내는 가짜
// eslint.js를 둬서 경로 판정과 훅 진입점을 확인한다(실제 규칙 발동은 PR 검증 절차에서 확인한다).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { decideFilenameCheck, findViolation } from './filename-case-check.mjs';

const HOOK = path.join(path.dirname(new URL(import.meta.url).pathname), 'filename-case-check.mjs');
const FAKE_ESLINT = `
const file = process.argv[process.argv.length - 1];
const messages = /badName/.test(file)
  ? [{ ruleId: 'unicorn/filename-case', message: 'Filename is not in kebab case.' }]
  : [];
process.stdout.write(JSON.stringify([{ filePath: file, messages }]));
process.exit(messages.length ? 1 : 0);
`;

let root;
let main;
let worktree;

function write(file, content = 'export {};\n') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

before(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'filename-case-test-')));
  main = path.join(root, 'link-sphere_FE_NEW');
  worktree = path.join(main, '.claude/worktrees/x');

  for (const base of [main, worktree]) {
    write(path.join(base, 'node_modules/eslint/bin/eslint.js'), FAKE_ESLINT);
    write(path.join(base, 'src/shared/utils/badName.ts'));
    write(path.join(base, 'src/shared/utils/good-name.ts'));
  }

  write(path.join(worktree, 'docs/note.ts'));
  write(path.join(root, 'link-sphere_BE_NEW/src/badName.ts'));
  write(path.join(root, 'other/src/badName.ts'));
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('decideFilenameCheck: FE 메인·워크트리의 src/ 아래 .ts/.tsx만 검사한다', () => {
  const wt = decideFilenameCheck({ filePath: 'src/shared/utils/badName.ts', cwd: worktree });
  assert.equal(wt.root, worktree);

  const mainTarget = decideFilenameCheck({
    filePath: path.join(main, 'src/shared/utils/badName.ts'),
    cwd: '/tmp',
  });
  assert.equal(mainTarget.root, main);

  for (const filePath of [
    path.join(root, 'link-sphere_BE_NEW/src/badName.ts'),
    path.join(root, 'other/src/badName.ts'),
    path.join(worktree, 'docs/note.ts'),
    path.join(worktree, 'src/shared/utils/missing.ts'),
    path.join(worktree, 'README.md'),
  ]) {
    assert.equal(decideFilenameCheck({ filePath, cwd: '/' }), null, filePath);
  }
});

test('decideFilenameCheck: 그 루트에 eslint가 없으면(부트스트랩 전 워크트리) 건너뛴다', () => {
  const exists = (p) => !p.endsWith('eslint.js');

  assert.equal(
    decideFilenameCheck(
      { filePath: path.join(worktree, 'src/shared/utils/badName.ts'), cwd: '/' },
      exists
    ),
    null
  );
});

test('findViolation: filename-case 위반 메시지만 고른다', () => {
  assert.equal(
    findViolation(
      JSON.stringify([
        { messages: [{ ruleId: 'curly', message: 'x' }] },
        { messages: [{ ruleId: 'unicorn/filename-case', message: 'kebab' }] },
      ])
    ),
    'kebab'
  );
  assert.equal(findViolation('[]'), null);
  assert.equal(findViolation('not json'), null);
});

test('훅 진입점: 워크트리의 위반 파일이면 exit 2, 아니면 exit 0', () => {
  const runHook = (filePath, cwd = '/') =>
    spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_input: { file_path: filePath }, cwd }),
      encoding: 'utf8',
      timeout: 20_000,
    });

  const bad = runHook(path.join(worktree, 'src/shared/utils/badName.ts'));
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /파일명 규칙을 어깁니다/);
  assert.match(bad.stderr, /kebab case/);

  assert.equal(runHook(path.join(worktree, 'src/shared/utils/good-name.ts')).status, 0);
  assert.equal(runHook(path.join(root, 'other/src/badName.ts')).status, 0);
  assert.equal(
    spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' }).status,
    0
  );
});
