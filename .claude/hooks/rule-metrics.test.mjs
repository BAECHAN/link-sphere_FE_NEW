// rule-metrics M14(머지 확인 창을 비켜 간 실행) 판정 회귀 테스트. 실행: node --test .claude/hooks/rule-metrics.test.mjs
// 사용자 설정 ask 규칙이 문자열로만 맞춘다는 점(래퍼·환경변수는 벗기고, 절대경로·sh -c·git -C는 못 맞춤)을
// 그대로 흉내 내는지 확인한다(docs/plans/2026-10-31-ai-loop-graph-readiness.md Phase 0).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { approvalBypassKinds, ASK_RULES_BY_PERIOD } from '../scripts/rule-metrics.mjs';

const CWD = '/w/link-sphere_FE_NEW/.claude/worktrees/x';
const MERGE = 'repos/o/r/pulls/1/merge';
const before = (command) => approvalBypassKinds(command, CWD, ASK_RULES_BY_PERIOD.before);
const after = (command) => approvalBypassKinds(command, CWD, ASK_RULES_BY_PERIOD.after);

test('ask 확장 전: gh api로 머지·규칙을 바꾸는 호출은 확인 창 없이 지나간다', () => {
  assert.deepEqual(before(`gh api -X PUT ${MERGE}`), ['api-merge']);
  assert.deepEqual(before(`gh api -XPUT ${MERGE}`), ['api-merge']);
  assert.deepEqual(before(`gh api --method=PUT ${MERGE}`), ['api-merge']);
  assert.deepEqual(before('gh api --method DELETE repos/o/r/rulesets/5'), ['api-rules']);
  assert.deepEqual(before('gh api repos/o/r/branches/main/protection -X PUT --input p.json'), [
    'api-rules',
  ]);
  assert.deepEqual(
    before(
      `gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`
    ),
    ['api-graphql']
  );
  assert.deepEqual(before('gh repo edit --delete-branch-on-merge'), ['repo-edit']);
});

test('조회와 다른 경로는 세지 않는다', () => {
  for (const command of [
    `gh api ${MERGE}`,
    'gh api repos/o/r/rulesets',
    `gh api -H 'Accept: application/json' ${MERGE}`,
    "gh api graphql -f query='query { viewer { login } }'",
    'gh api -X POST repos/o/r/issues -f title=t',
    'gh api repos/o/r/actions/runs',
    'gh pr view 1',
  ]) {
    assert.deepEqual(before(command), [], command);
  }
});

test('본문 플래그가 있으면 메서드 없이도 POST로 본다', () => {
  assert.deepEqual(before('gh api repos/o/r/rulesets -f name=x'), ['api-rules']);
  assert.deepEqual(before('gh api repos/o/r/rulesets --input=r.json'), ['api-rules']);
});

test('ask 확장 후: 그대로 쓴 형태는 확인 창에 걸린다', () => {
  for (const command of [
    `gh api -X PUT ${MERGE}`,
    'gh api --method DELETE repos/o/r/rulesets/5',
    'gh api repos/o/r/branches/main/protection -X PUT --input p.json',
    `gh api graphql -f query='mutation { mergePullRequest(input: {}) { clientMutationId } }'`,
    'gh repo edit --delete-branch-on-merge',
    'gh pr merge 1 --squash',
    'gh pr merge',
    'git push origin main',
    'git push -u origin main',
    'git push origin HEAD:main',
    `timeout 30 gh api -X PUT ${MERGE}`,
    `GH_TOKEN=x gh api -X PUT ${MERGE}`,
    `cd /tmp && gh api -X PUT ${MERGE}`,
  ]) {
    assert.deepEqual(after(command), [], command);
  }
});

test('ask 확장 후에도 다르게 쓴 형태는 비켜 간다', () => {
  assert.deepEqual(after(`/opt/homebrew/bin/gh api -X PUT ${MERGE}`), ['api-merge']);
  assert.deepEqual(after(`bash -c 'gh api -X PUT ${MERGE}'`), ['api-merge']);
  assert.deepEqual(after("sh -lc 'gh pr merge 1 --squash'"), ['pr-merge']);
  assert.deepEqual(after('/opt/homebrew/bin/gh pr merge 1'), ['pr-merge']);
  assert.deepEqual(after(`git -C ${CWD} push origin main`), ['push-main']);
  assert.deepEqual(after(`/usr/bin/git -C ${CWD} push origin main`), ['push-main']);
  assert.deepEqual(after('git push origin refs/heads/main'), ['push-main']);
});

test('변수로 조립한 경로는 바꾸는 호출만 따로 센다', () => {
  assert.deepEqual(after('gh api -X PUT "$URL"'), ['api-unresolved']);
  assert.deepEqual(after('gh api "$URL"'), []);
  // 경로 일부만 변수면 남은 글자(rulesets)로 ask 규칙이 걸린다.
  assert.deepEqual(before('gh api "repos/o/r/rulesets/$ID" -X DELETE'), ['api-unresolved']);
  assert.deepEqual(after('gh api "repos/o/r/rulesets/$ID" -X DELETE'), []);
});

test('저장소 설정 PATCH는 ask 규칙에 없어 계속 센다', () => {
  assert.deepEqual(after('gh api -X PATCH repos/o/r -F delete_branch_on_merge=true'), [
    'api-repo-settings',
  ]);
  assert.deepEqual(after('gh api repos/o/r'), []);
  assert.deepEqual(after('gh api -X PATCH repos/o/r/issues/1 -f state=closed'), []);
});

test('push는 link-sphere 레포만, 상대 -C는 한 번만 풀어 센다', () => {
  assert.deepEqual(after('git -C /tmp/scratch/work push origin main'), []);
  // 두 번 풀면 /w로 올라가 레포 밖이 된다.
  assert.deepEqual(after('git -C ../../.. push origin main'), ['push-main']);
});

test('main이 아닌 push와 머지와 무관한 repo edit는 세지 않는다', () => {
  assert.deepEqual(after(`git -C ${CWD} push origin feature`), []);
  assert.deepEqual(after(`git -C ${CWD} push -u origin HEAD`), []);
  assert.deepEqual(after('git push origin main-fix'), []);
  assert.deepEqual(before('gh repo edit o/r --homepage "https://example.com"'), []);
  assert.deepEqual(before('gh repo edit o/r --enable-squash-merge=false'), ['repo-edit']);
});
