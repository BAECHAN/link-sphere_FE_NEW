// 경로 지정 커밋(git commit -- <경로>) 뒤 실제 인덱스가 lint-staged 이전 내용으로 남지 않는지 확인하는 회귀 테스트.
// 실행: node --test .husky/scripts/*.test.mjs
// 임시 디렉터리에 git 레포를 만들고, 이 레포의 lint-staged 설정과 설치된 lint-staged·prettier로 pre-commit을
// 돌린다. lint-staged 16.2.7에서는 prettier가 고친 파일이 커밋 직후 `git status`에 MM으로 남았다
// (docs/CI-CHECK-GATE.md §9.8, docs/plans/2026-10-16-lint-staged-pathspec-index.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const BIN = path.join(REPO_ROOT, 'node_modules/.bin');
const LINT_STAGED_CONFIG = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))[
  'lint-staged'
];

// prettier가 열 너비를 다시 맞추는 표 — 커밋된 내용이 이것과 달라야 훅이 실제로 돈 것이다.
const UNFORMATTED_TABLE = '| a | b |\n|---|---|\n| long cell | x |\n';

let root;
let hooksDir;

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // 훅이 이 PATH를 물려받아 lint-staged 설정의 prettier·eslint를 이 레포의 것으로 찾는다.
    env: { ...process.env, PATH: `${BIN}${path.delimiter}${process.env.PATH}` },
  });
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** lint-staged pre-commit이 걸린 레포를 만들고 tracked.md를 커밋해 둔다. */
function makeRepo(name) {
  const dir = path.join(root, name);

  fs.mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'core.hooksPath', hooksDir);
  write(
    path.join(dir, 'package.json'),
    `${JSON.stringify({ private: true, 'lint-staged': LINT_STAGED_CONFIG }, null, 2)}\n`
  );
  write(path.join(dir, 'tracked.md'), 'tracked\n');
  git(dir, 'add', '--', 'package.json', 'tracked.md');
  git(dir, 'commit', '-q', '--no-verify', '-m', 'init');

  return dir;
}

before(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lint-staged-pathspec-test-')));
  hooksDir = path.join(root, 'hooks');
  write(path.join(hooksDir, 'pre-commit'), `#!/bin/sh\nexec "${path.join(BIN, 'lint-staged')}"\n`);
  fs.chmodSync(path.join(hooksDir, 'pre-commit'), 0o755);
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('새 파일을 add한 뒤 경로 지정 커밋하면 인덱스가 커밋과 같다', () => {
  const repo = makeRepo('new-file');

  write(path.join(repo, 'new.md'), UNFORMATTED_TABLE);
  git(repo, 'add', '--', 'new.md');
  git(repo, 'commit', '-q', '-m', 'new', '--', 'new.md');

  assert.notEqual(git(repo, 'show', 'HEAD:new.md'), UNFORMATTED_TABLE);
  assert.equal(git(repo, 'status', '--porcelain'), '');
});

test('추적 중인 파일을 add 없이 경로 지정 커밋해도 인덱스가 커밋과 같다', () => {
  const repo = makeRepo('tracked-file');

  write(path.join(repo, 'tracked.md'), UNFORMATTED_TABLE);
  git(repo, 'commit', '-q', '-m', 'edit', '--', 'tracked.md');

  assert.notEqual(git(repo, 'show', 'HEAD:tracked.md'), UNFORMATTED_TABLE);
  assert.equal(git(repo, 'status', '--porcelain'), '');
});

test('링크드 워크트리에서 새 파일을 경로 지정 커밋해도 인덱스가 커밋과 같다', () => {
  const repo = makeRepo('worktree-base');
  const worktree = path.join(root, 'worktree');

  git(repo, 'worktree', 'add', '-q', '-b', 'wt', worktree);
  write(path.join(worktree, 'new.md'), UNFORMATTED_TABLE);
  git(worktree, 'add', '--', 'new.md');
  git(worktree, 'commit', '-q', '-m', 'new', '--', 'new.md');

  assert.notEqual(git(worktree, 'show', 'HEAD:new.md'), UNFORMATTED_TABLE);
  assert.equal(git(worktree, 'status', '--porcelain'), '');
});

test('경로 밖에 따로 스테이징한 파일은 커밋에 섞이지 않고 스테이징된 채 남는다', () => {
  const repo = makeRepo('outside-pathspec');

  write(path.join(repo, 'staged.md'), 'staged\n');
  git(repo, 'add', '--', 'staged.md');
  write(path.join(repo, 'tracked.md'), UNFORMATTED_TABLE);
  git(repo, 'commit', '-q', '-m', 'edit', '--', 'tracked.md');

  assert.notEqual(git(repo, 'show', 'HEAD:tracked.md'), UNFORMATTED_TABLE);
  assert.doesNotMatch(git(repo, 'ls-tree', '--name-only', 'HEAD'), /staged\.md/);
  assert.equal(git(repo, 'status', '--porcelain'), 'A  staged.md\n');
});
