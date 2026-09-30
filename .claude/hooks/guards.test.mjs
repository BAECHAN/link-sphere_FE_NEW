// bash-guard·edit-guard 회귀 테스트. 실행: node --test .claude/hooks/guards.test.mjs
// 임시 디렉터리에 link-sphere_FE_NEW라는 이름의 실제 git 레포와 워크트리를 만들어, 추적 여부·
// 충돌 상태·gitignore 판정을 실제 git으로 확인한다(docs/plans/2026-09-29-rule-enforcement-
// hardening.md Phase 2 "합성 payload" 표 + 경계 사례).
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { decide } from './bash-guard.mjs';
import { decideEdit } from './edit-guard.mjs';

const HOOKS_DIR = path.dirname(new URL(import.meta.url).pathname);

let root;
let main;
let worktree;
let conflictWorktree;

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

before(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-test-')));
  main = path.join(root, 'link-sphere_FE_NEW');
  fs.mkdirSync(main);
  git(main, 'init', '-q', '-b', 'main');
  write(path.join(main, 'tracked.ts'), 'base\n');
  write(path.join(main, 'src/a.ts'), 'a\n');
  write(path.join(main, '.gitignore'), '*.local.json\n.claude/worktrees/\n');
  git(main, 'add', '-A');
  git(main, 'commit', '-q', '-m', 'init');

  worktree = path.join(main, '.claude/worktrees/x');
  git(main, 'worktree', 'add', '-q', '-b', 'wt-x', worktree);
  write(path.join(worktree, 'new.ts'), 'new\n');
  write(path.join(worktree, 'newdir/b.ts'), 'b\n');

  conflictWorktree = path.join(main, '.claude/worktrees/conflict');
  git(main, 'worktree', 'add', '-q', '-b', 'wt-conflict', conflictWorktree);
  write(path.join(conflictWorktree, 'tracked.ts'), 'from worktree\n');
  git(conflictWorktree, 'commit', '-q', '-am', 'wt change');
  write(path.join(main, 'tracked.ts'), 'from main\n');
  git(main, 'commit', '-q', '-am', 'main change');

  try {
    git(conflictWorktree, 'merge', 'main');
  } catch {
    // 충돌이 나는 게 정상 — MERGE_HEAD가 남는다.
  }
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const run = (command, cwd, agentId) => decide({ command, cwd, agentId });

test('G1: 광범위 스테이징은 어디서나 막는다', () => {
  assert.equal(run('git add -A', worktree).action, 'deny');
  assert.equal(run(`cd ${worktree} && git add .`, main).action, 'deny');
  assert.equal(run(`git -C ${worktree} add -u`, main).action, 'deny');
  assert.equal(run('git add src/*.ts', worktree).action, 'deny');
  assert.equal(run('git commit -am "x"', worktree).action, 'deny');
  assert.equal(run('git rm -r .', worktree).action, 'deny');
});

test('G2: 메인 체크아웃의 git add·git rm은 막는다', () => {
  assert.equal(run('git add src/a.ts', main).action, 'deny');
  assert.equal(run('git rm src/a.ts', main).action, 'deny');
  assert.match(run('git add src/a.ts', main).reason, /EnterWorktree/);
});

test("G2': 워크트리에서는 한 번도 추적되지 않은 경로만 add할 수 있다", () => {
  assert.equal(run('git add -- new.ts', worktree).action, 'allow');
  assert.equal(run('git add -- newdir/', worktree).action, 'allow');
  assert.equal(run('git add -N new.ts', worktree).action, 'allow');

  const mixed = run('git add -- new.ts tracked.ts', worktree);
  assert.equal(mixed.action, 'deny');
  assert.match(mixed.reason, /tracked\.ts/);
});

test("G2': -A·-u도 경로를 주면 그 경로 안으로 좁혀지므로 경로 규칙으로 판정한다", () => {
  assert.equal(run('git add -A -- new.ts', worktree).action, 'allow');
  assert.equal(run('git add -A -- tracked.ts', worktree).action, 'deny');
  assert.match(run('git add -A -- tracked.ts', worktree).reason, /이미 git이 추적/);
  assert.equal(run('git add -A', worktree).action, 'deny');
  assert.equal(run('git add -A -- .', worktree).action, 'deny');
});

test("G2': 충돌 해결 중에는 추적 파일도 add할 수 있다", () => {
  assert.ok(fs.existsSync(path.join(main, '.git/worktrees/conflict/MERGE_HEAD')));
  assert.equal(run('git add tracked.ts', conflictWorktree).action, 'allow');
});

test('충돌 해결 중 전체 경로 커밋은 경로 없는 커밋으로 마무리하라고 안내한다', () => {
  const concluding = run('git commit -m "merge: main" -- .', conflictWorktree);
  assert.equal(concluding.action, 'deny');
  assert.match(concluding.reason, /경로 없이/);
  assert.match(run('git commit -m x -- .', worktree).reason, /커밋할 경로를 지정/);
});

test('워크트리 안 git rm <경로>는 허용한다', () => {
  assert.equal(run('git rm tracked.ts', worktree).action, 'allow');
});

test('G3: git commit 옵션이 -- 뒤에 오면 막는다', () => {
  assert.equal(run('git commit -- a.ts -m msg', worktree).action, 'deny');
  assert.equal(run('git commit -m x -- a.ts', worktree).action, 'allow');
  assert.equal(run('git commit -m "add -a flag handling" -- a.ts', worktree).action, 'allow');
});

test('heredoc·따옴표 안의 명령 문자열은 명령으로 보지 않는다', () => {
  const heredoc = `git commit -m "$(cat <<'EOF'\ngit add -A\nrm -rf /\nEOF\n)" -- a.ts`;
  assert.equal(run(heredoc, worktree).action, 'allow');
  assert.equal(run('echo "git add -A"', worktree).action, 'allow');
  assert.equal(run('grep -n "rm" README.md', worktree).action, 'allow');
});

test('G4: stash는 서브에이전트면 차단, 메인 스레드면 사용자 확인', () => {
  assert.equal(run('git stash', worktree, 'agent-1').action, 'deny');
  assert.equal(run('git stash', worktree).action, 'ask');
  assert.equal(run('git stash push -u -m tag', worktree).action, 'ask');
  assert.equal(run('git stash list', worktree, 'agent-1').action, 'allow');
});

test('G4: 되돌리기 어려운 명령은 메인 스레드에서도 막는다', () => {
  assert.equal(run('git reset --hard', worktree).action, 'deny');
  assert.equal(run('git reset --hard origin/main', worktree).action, 'deny');
  assert.equal(run('git checkout -- .', worktree).action, 'deny');
  assert.equal(run('git restore .', worktree).action, 'deny');
  assert.equal(run('git clean -fd', worktree).action, 'deny');
  assert.equal(run('git checkout -- src/a.ts', worktree).action, 'allow');
  assert.equal(run('git restore --staged .', worktree).action, 'allow');
  assert.equal(run('git clean -n', worktree).action, 'allow');
  assert.equal(run('git reset --soft HEAD~1', worktree).action, 'allow');
});

test('git clean -f <경로>는 rm 우회로 막고, rm으로 바꿔 주지 않고 -n으로 목록부터 확인하게 한다', () => {
  const result = run('git clean -f -- probe.ts', worktree);
  assert.equal(result.action, 'deny');
  assert.match(result.reason, /rm을 우회/);
  assert.match(result.reason, /git clean -n/);

  const exclude = run('git clean -fdx -e .env', worktree);
  assert.equal(exclude.action, 'deny');
  assert.ok(!/\n {2}rm /.test(exclude.reason));
});

test('리다이렉션·줄 이음 토큰을 경로로 읽지 않는다(적대적 검증 bypass-1)', () => {
  assert.equal(run('git add -A 2>&1', worktree).action, 'deny');
  assert.equal(run('git add -u > /dev/null', worktree).action, 'deny');
  assert.equal(run('git add --all >/dev/null 2>&1', worktree).action, 'deny');
  assert.equal(run('git add -A 2>/dev/null', worktree).action, 'deny');
  assert.equal(run('git add -A &>/dev/null', worktree).action, 'deny');
  assert.equal(run('git add -A \\\n  && git commit -m "x" -- src/a.ts', worktree).action, 'deny');
  assert.equal(run('git add -u 2>&1 | tail -1', worktree, 'a1').action, 'deny');
  assert.equal(run('git add -A 2>&1\ngit status --short 2>&1', worktree).action, 'deny');
  assert.equal(run('git add -- new.ts 2>&1', worktree).action, 'allow');
});

test('서브셸·제어문·래퍼 안의 git도 판정한다(bypass-2)', () => {
  assert.equal(run('if ! git diff --quiet; then git stash; fi', worktree, 'a1').action, 'deny');
  assert.equal(run('(git stash)', worktree, 'a1').action, 'deny');
  assert.equal(run('time git stash', worktree, 'a1').action, 'deny');
  assert.equal(run('{ git stash; }', worktree, 'a1').action, 'deny');
  assert.equal(run('(git reset --hard)', worktree).action, 'deny');
  assert.equal(run('if true; then git reset --hard origin/main; fi', worktree).action, 'deny');
  assert.equal(run('if ! git diff --quiet; then git stash; fi', worktree).action, 'ask');
  assert.equal(run('(git add src/a.ts)', main).action, 'deny');
  assert.equal(run('for f in src/a.ts; do git add "$f"; done', main).action, 'deny');
  assert.equal(run(`(cd ${main} && git add src/a.ts)`, worktree).action, 'deny');
  assert.equal(run('X=$(git stash list)', worktree, 'a1').action, 'allow');
});

test('서브셸·pushd로 옮긴 디렉터리는 그 범위에서만 적용한다(false-positive-2)', () => {
  assert.equal(run(`(cd ${worktree} && git add -- new.ts)`, main).action, 'allow');
  assert.equal(run(`pushd ${worktree} >/dev/null && git add -- new.ts`, main).action, 'allow');
  assert.equal(
    run(`(cd ${worktree} && git add -- new.ts) && git add src/a.ts`, main).action,
    'deny'
  );
});

test('전체 경로 커밋·전체 되돌리기의 변형도 막는다(bypass-3, bypass-4)', () => {
  assert.equal(run('git commit -m "x" -- .', worktree).action, 'deny');
  assert.equal(run('git commit -m "x" .', worktree).action, 'deny');
  assert.equal(run('git commit -m "x" -- :/', worktree).action, 'deny');
  assert.equal(run('git commit -am"fix typo"', worktree).action, 'deny');
  assert.equal(run('git commit -m "*" -- a.ts', worktree).action, 'allow');
  assert.equal(run('git checkout HEAD .', worktree).action, 'deny');
  assert.equal(run('git checkout main .', worktree).action, 'deny');
  assert.equal(run('git checkout -- ./', worktree).action, 'deny');
  assert.equal(run('git checkout -- :/', worktree).action, 'deny');
  assert.equal(run('git checkout -f', worktree).action, 'deny');
  assert.equal(run("git restore -- '*'", worktree).action, 'deny');
  assert.equal(run('git restore ./', worktree).action, 'deny');
  assert.equal(run('git switch --discard-changes wt-x', worktree).action, 'deny');
  assert.equal(run('git checkout -b feature', worktree).action, 'allow');
  assert.equal(run('git switch main', worktree).action, 'allow');
});

test('git stage와 --pathspec-from-file도 add 규칙을 따른다(bypass-6)', () => {
  assert.equal(run('git stage -A', worktree).action, 'deny');
  assert.equal(run('git stage src/a.ts', main).action, 'deny');
  assert.equal(run('git add --pathspec-from-file=paths.txt', worktree).action, 'deny');
});

test('셸 주석은 명령으로도 경로로도 읽지 않는다(bypass-7, false-positive-4)', () => {
  assert.equal(run("# stage everything (it's fine)\ngit add -A", worktree).action, 'deny');
  assert.equal(
    run("# let's check types\ngit stash && pnpm type-check", worktree, 'a1').action,
    'deny'
  );
  assert.equal(
    run('git commit -m "fix: x" -- tracked.ts  # -m must come before --', worktree).action,
    'allow'
  );
  assert.equal(run('git add -- new.ts # instead of git add .', worktree).action, 'allow');
  assert.equal(run('git add -- new.ts  # not git add *.ts', worktree).action, 'allow');
});

test('인용 안 heredoc 본문의 따옴표가 뒤 명령을 어긋나게 하지 않는다(false-positive-5)', () => {
  const pr = `git push -u origin HEAD && gh pr create --title "fix: x" --body "$(cat <<'EOF'\n## 요약\n- 27" 모니터 레이아웃 대응\nrm -rf 대신 절대경로 안내로 바꿈\nEOF\n)"`;
  assert.equal(run(pr, worktree).action, 'allow');

  const commit = `git commit -m "$(cat <<'EOF'\ndocs: 큰따옴표(") 하나와 git stash 언급\nEOF\n)" -- a.ts`;
  assert.equal(run(commit, worktree, 'agent-1').action, 'allow');

  const dashed = `cat > /tmp/msg.txt <<'END-OF-MSG'\nrm -rf /\nEND-OF-MSG\ngit commit -F /tmp/msg.txt -- a.ts`;
  assert.equal(run(dashed, worktree).action, 'allow');
});

test('확정할 수 없는 경로(변수·명령 치환)는 판정을 건너뛴다(false-positive-1)', () => {
  const scratch = 'SP=/tmp/scratch-e2e\ncd "$SP/work"\ngit add -A';
  assert.equal(run(scratch, worktree).action, 'allow');
  assert.equal(run('cd $(mktemp -d) && git add -A', main).action, 'allow');
});

test('미리보기·인덱스만 되돌리는 명령은 통과시킨다(false-positive-3, 7)', () => {
  assert.equal(run('git add -n -A', worktree).action, 'allow');
  assert.equal(run('git add --dry-run .', worktree).action, 'allow');
  assert.equal(run('git restore -S .', worktree).action, 'allow');
  assert.equal(run('git restore --source=HEAD -S .', worktree).action, 'allow');
  assert.equal(run('git restore -SW .', worktree).action, 'deny');
});

test('rm 안내는 ~·glob·변수를 셸이 실제로 해석하는 형태로 준다(policy-3, robustness-7)', () => {
  const home = run('rm -rf ~/tmp/foo', worktree).reason;
  assert.ok(home.includes(`rm -rf ${path.join(os.homedir(), 'tmp/foo')}`));

  const glob = run('rm -rf dist/*', worktree).reason;
  assert.ok(glob.includes(`rm -rf ${path.join(worktree, 'dist')}/*`));
  assert.ok(!glob.includes("'"));

  const variable = run('rm -rf "$TMPDIR/foo"', worktree).reason;
  assert.ok(variable.includes('rm -rf $TMPDIR/foo'));
  assert.match(variable, /확정하지 못했다/);

  assert.ok(!run('rm -rf build 2>/dev/null', worktree).reason.includes('/dev/null'));
  assert.ok(!run('rm -rf build', root).reason.includes('워크트리 안에서 git rm'));
  assert.ok(run('rm -rf build', worktree).reason.includes('워크트리 안에서 git rm'));
});

test('메인 체크아웃 차단 안내는 세션 위치에 맞춘다(policy-5)', () => {
  assert.match(run(`cd ${main} && git add src/a.ts`, worktree).reason, /이미 워크트리/);
  assert.match(
    run(`git -C ${main} add src/a.ts`, '/Users/someone/project/link-sphere/link-sphere_BE_NEW')
      .reason,
    /세션을 열어 달라고/
  );
  assert.match(run('git add src/a.ts', main).reason, /EnterWorktree/);
});

test('stash 확인은 사용자용 사유와 Claude용 안내를 따로 준다(policy-2)', () => {
  const result = run('git stash', worktree);
  assert.equal(result.action, 'ask');
  assert.ok(result.reason.length < 120);
  assert.match(result.context, /git stash apply <sha>/);
});

test('link-sphere 밖의 레포에는 git 규칙을 적용하지 않는다', () => {
  assert.equal(run('git add -A', root).action, 'allow');
  assert.equal(run('git -C /tmp/somewhere add -A', worktree).action, 'allow');
  assert.equal(run('git reset --hard', root).action, 'allow');
});

test('rm은 막고 절대경로 명령을 안내한다', () => {
  const result = run('rm -rf build/out', worktree);
  assert.equal(result.action, 'deny');
  assert.match(result.reason, new RegExp(`rm -rf ${path.join(worktree, 'build/out')}`));
});

test('평범한 명령은 통과시킨다', () => {
  assert.equal(run('git status --short', worktree).action, 'allow');
  assert.equal(run('git log --oneline -3', main).action, 'allow');
  assert.equal(run('git pull --ff-only', main).action, 'allow');
  assert.equal(run('pnpm test', worktree).action, 'allow');
});

test('edit-guard: 메인 체크아웃 편집은 막고, 워크트리·gitignore·레포 밖은 허용', () => {
  const inMain = decideEdit({ filePath: path.join(main, 'src/a.ts'), cwd: main });
  assert.equal(inMain.action, 'deny');
  assert.match(inMain.reason, /EnterWorktree/);

  assert.equal(decideEdit({ filePath: 'src/a.ts', cwd: main }).action, 'deny');
  assert.equal(
    decideEdit({ filePath: path.join(worktree, 'src/a.ts'), cwd: worktree }).action,
    'allow'
  );
  assert.equal(
    decideEdit({ filePath: path.join(main, 'settings.local.json'), cwd: main }).action,
    'allow'
  );
  assert.equal(
    decideEdit({ filePath: path.join(root, 'elsewhere.txt'), cwd: main }).action,
    'allow'
  );
});

test('edit-guard: 워크트리 세션이면 워크트리 경로를, 다른 레포 세션이면 세션을 열어 달라고 안내', () => {
  const fromWorktree = decideEdit({ filePath: path.join(main, 'src/a.ts'), cwd: worktree });
  assert.equal(fromWorktree.action, 'deny');
  assert.ok(fromWorktree.reason.includes(path.join(worktree, 'src/a.ts')));

  const fromOtherRepo = decideEdit({
    filePath: path.join(main, 'src/a.ts'),
    cwd: '/Users/someone/project/link-sphere/link-sphere_BE_NEW',
  });
  assert.equal(fromOtherRepo.action, 'deny');
  assert.match(fromOtherRepo.reason, /세션을 열어 달라고/);
});

function runHook(script, payload) {
  return spawnSync('bash', [path.join(HOOKS_DIR, 'run-node.sh'), script], {
    input: payload,
    encoding: 'utf8',
  });
}

test('run-node.sh: 차단은 exit 2 + stderr, 확인은 JSON, 잘못된 입력은 통과', () => {
  const denied = runHook(
    'bash-guard.mjs',
    JSON.stringify({ tool_input: { command: 'git add -A' }, cwd: worktree })
  );
  assert.equal(denied.status, 2);
  assert.match(denied.stderr, /\[bash-guard\]/);

  const asked = runHook(
    'bash-guard.mjs',
    JSON.stringify({ tool_input: { command: 'git stash' }, cwd: worktree })
  );
  assert.equal(asked.status, 0);
  assert.equal(JSON.parse(asked.stdout).hookSpecificOutput.permissionDecision, 'ask');

  const edit = runHook(
    'edit-guard.mjs',
    JSON.stringify({ tool_input: { file_path: path.join(main, 'src/a.ts') }, cwd: main })
  );
  assert.equal(edit.status, 2);
  assert.match(edit.stderr, /\[edit-guard\]/);

  assert.equal(runHook('bash-guard.mjs', 'not json').status, 0);
  assert.equal(runHook('missing.mjs', '{}').status, 0);
});
