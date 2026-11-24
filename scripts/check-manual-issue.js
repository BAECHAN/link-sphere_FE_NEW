// `node scripts/check-manual-issue.js <본문 파일>` (= `pnpm check:manual-issue <본문 파일>`)
//   확인 이슈를 열기 전에 본문 형식을 검사한다. `gh issue create --label manual-check --body-file`에 넘길 파일 그대로.
//
// `node scripts/check-manual-issue.js --evaluate <이슈 JSON> <댓글 NDJSON>`
//   manual-check.yml이 이슈와 댓글을 API로 받아 넘긴다. 판정과 워크플로가 할 일을 GITHUB_OUTPUT에 쓴다
//   (로컬에서는 표준 출력으로 보여 준다). 이벤트는 EVENT_NAME·EVENT_ACTION·REMOVED_LABEL 환경변수로 받는다.
//
// 판정 규칙은 lib/manual-check.js, 왜 이 검사가 있는지는 docs/MANUAL-CHECK.md.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decideActions,
  evaluateIssue,
  LABEL,
  parseIssueBody,
  renderStatusComment,
  renderUnlabeledNote,
} from './lib/manual-check.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 배포되는 빌드는 main의 커밋이다. 워크플로의 checkout과 로컬 워크트리 모두 이 원격 추적 브랜치를 갖는다
const MAIN_REF = 'origin/main';

function resolveCommit(sha) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function isAncestor(ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: ROOT,
      stdio: 'ignore',
    });

    return true;
  } catch {
    return false;
  }
}

/** 확인할 빌드가 저장소의 main에 있는 커밋인가. 문제가 없으면 null */
function findRequiredBuildProblem(required) {
  const full = resolveCommit(required);

  if (!full) {
    return `확인할 빌드(${required})를 저장소에서 찾지 못했습니다 — 오타이거나 자릿수가 모자랍니다`;
  }

  if (!isAncestor(full, MAIN_REF)) {
    return `확인할 빌드(${required})가 main에 없는 커밋입니다 — 병합 커밋의 값을 적습니다`;
  }

  return null;
}

/**
 * 답 댓글에 적힌 빌드가 main에 있고 확인할 빌드를 포함하는가. 문제가 없으면 null.
 * 확인할 빌드 자체가 틀린 이슈는 본문 형식 오류로 먼저 걸러져 여기까지 오지 않는다(findRequiredBuildProblem).
 */
function checkBuild(typed, required) {
  const typedFull = resolveCommit(typed);

  if (!typedFull) {
    return '저장소에서 찾을 수 없는 값입니다 — 버전 화면(/version)의 값을 다시 확인해 주세요';
  }

  if (!isAncestor(typedFull, MAIN_REF)) {
    return 'main에 없는 커밋입니다 — 버전 화면(/version)의 값을 다시 확인해 주세요';
  }

  if (!isAncestor(resolveCommit(required), typedFull)) {
    return `확인할 빌드(${required})가 들어가기 전의 빌드입니다 — 새로고침해 최신 빌드로 바꾼 뒤 다시 확인해 주세요`;
  }

  return null;
}

function checkBodyFile(bodyFile) {
  const { problems, requiredBuild } = parseIssueBody(fs.readFileSync(bodyFile, 'utf8'));
  const buildProblem = requiredBuild ? findRequiredBuildProblem(requiredBuild) : null;
  const all = buildProblem ? [...problems, buildProblem] : problems;

  if (all.length === 0) {
    console.log('확인 이슈 본문 형식 확인 통과');
    process.exit(0);
  }

  for (const problem of all) {
    console.log(`- ${problem}`);
  }

  console.log('\n형식과 채우는 법은 docs/MANUAL-CHECK.md');
  process.exit(1);
}

function readComments(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/** 여러 줄 값은 본문에 나올 수 없는 구분자로 감싸 넘긴다(본문은 누구나 쓸 수 있는 입력이다) */
function writeOutputs(outputs) {
  const lines = Object.entries(outputs).map(([key, value]) => {
    const delimiter = `MANUAL_CHECK_${randomUUID()}`;

    return `${key}<<${delimiter}\n${value}\n${delimiter}`;
  });

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
    return;
  }

  console.log(JSON.stringify(outputs, null, 2));
}

/** 상태 댓글이 가리킬 문서의 절대 주소. Actions 밖(로컬 시험)에서는 없다 */
function findDocsUrl() {
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repository } = process.env;

  return server && repository
    ? `${server}/${repository}/blob/main/docs/MANUAL-CHECK.md`
    : undefined;
}

function evaluate(issueFile, commentsFile) {
  const issue = JSON.parse(fs.readFileSync(issueFile, 'utf8'));
  const hasLabel = issue.labels.some((label) => label.name === LABEL);
  const labelRemoved =
    process.env.EVENT_ACTION === 'unlabeled' && process.env.REMOVED_LABEL === LABEL && !hasLabel;
  const nothing = {
    status: 'skipped',
    reopen: false,
    close: false,
    note_unlabeled: false,
    update_status: false,
    comment: '',
  };

  // 실행을 기다리는 사이 라벨이 떼어진 이슈는 건드리지 않는다
  if (!hasLabel && !labelRemoved) {
    writeOutputs(nothing);
    return;
  }

  const evaluation = evaluateIssue({
    body: issue.body,
    comments: readComments(commentsFile),
    checkBuild,
    checkRequiredBuild: findRequiredBuildProblem,
  });
  const actions = decideActions(evaluation, {
    name: process.env.EVENT_NAME ?? '',
    action: process.env.EVENT_ACTION ?? '',
    state: issue.state,
    labelRemoved,
  });

  console.log(
    `#${issue.number} 판정: ${evaluation.status} (남은 단계 ${evaluation.missing.join(', ') || '없음'}, 세지 않은 답 ${evaluation.rejected.length}건)`
  );
  writeOutputs({
    status: evaluation.status,
    reopen: actions.reopen,
    close: actions.close,
    note_unlabeled: actions.noteUnlabeled,
    update_status: actions.updateStatus,
    comment: actions.noteUnlabeled
      ? renderUnlabeledNote(evaluation)
      : renderStatusComment(evaluation, actions, findDocsUrl()),
  });
}

const [first, second, third] = process.argv.slice(2);

if (first === '--evaluate' && second && third) {
  evaluate(second, third);
} else if (first && first !== '--evaluate') {
  checkBodyFile(first);
} else {
  console.log(
    '사용법: node scripts/check-manual-issue.js <본문 파일> | --evaluate <이슈 JSON> <댓글 NDJSON>'
  );
  process.exit(2);
}
