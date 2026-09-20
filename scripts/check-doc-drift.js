// N개(기본 5) PR이 새로 병합될 때마다 삭제된 export/파일 경로가 문서·코드에 그대로
// 남아있는지 grep으로 기계적으로 검사해 GitHub 이슈에 보고한다.
// .github/workflows/doc-drift-check.yml이 main에 push될 때마다 이 스크립트를 실행한다.
//
// 원래는 claude.ai 루틴(클라우드 LLM 에이전트, 6시간 폴링)으로 만들었으나, 이 검사
// 자체가 git log 파싱 + grep + check-docs.js 실행뿐인 결정론적 작업이라 LLM이 필요
// 없었고, 폴링이라 병합 시점보다 최대 6시간 늦게 잡히는 문제도 있어 GitHub Actions
// 기반으로 다시 만들었다(2026-09-14). 상태(마지막 확인 커밋·누적 병합 수)는 레포에
// 커밋하지 않고 트래킹 이슈 본문의 마커 주석에만 저장한다 — 이 워크플로는 절대
// 레포에 쓰기 작업을 하지 않는다.
//
// 기준 미달(누적<5)일 때는 이슈 본문의 대시보드(진행도·마지막 확인 커밋·갱신 시각)만
// 갱신하고 댓글은 달지 않는다 — 그 상태는 console.log로 Actions run 로그에도 남는다.
// 실제 검사가 도는 경량 감사 때만 결과를 댓글로 남기고, 통과해도 항상 남긴다(2026-09-21
// — push마다 달던 "확인함 — 누적 N/5" 하트비트 댓글이 트래킹 이슈 댓글의 84%를 차지해
// 최신 상태를 보려면 매번 끝까지 스크롤해야 하던 문제를 고치며 이렇게 정리했다).
//
// 한계: 이 스크립트는 "삭제된 export/파일 경로가 여전히 참조되는가"만 기계적으로
// 본다. 산문 서술·다이어그램이 의미적으로만 낡은 경우(예: 2026-09-14
// FE-ARCHITECTURE.md 사례 — 파일은 존재하고 줄 번호도 파일 범위 안인데 서술 내용이
// 낡았던 것)는 못 잡는다. 그런 종류는 사람이 요청하는 전체 subagent 감사의 몫이라,
// 매 보고에 이 한계를 명시한다.
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const THRESHOLD = Number(process.env.DOC_DRIFT_THRESHOLD || 5);
const REPO = process.env.GITHUB_REPOSITORY;
const LABEL = 'doc-drift-check';
const ISSUE_TITLE = '[자동] 문서-코드 정합성 경량 점검 트래커';
const STATE_RE =
  /<!--\s*doc-drift-state:\s*last_checked_sha=([0-9a-f]+),\s*merges_since_audit=(\d+)\s*-->/;
const LAST_AUDIT_MARKER = '<!-- last-audit -->';
const MERGE_COMMIT_RE = /\(#\d+\)\s*$/;
const WATCHED_PATHS = ['src/entities/', 'src/shared/config/texts.ts'];

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
}

function gh(args) {
  return run('gh', args);
}

function git(args) {
  return run('git', args);
}

function tempFile(content) {
  const dir = mkdtempSync(join(tmpdir(), 'doc-drift-'));
  const file = join(dir, 'body.md');

  writeFileSync(file, content, 'utf8');

  return file;
}

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 16);
}

// 본문의 '<!-- last-audit -->' 이후를 그대로 잘라 다음 buildBody 호출에 넘긴다 — 감사가
// 안 도는 기준 미달 구간에도 "마지막 감사가 언제 무엇을 봤는지" 표가 본문에 남는다.
function extractAuditSection(body) {
  const index = body.indexOf(LAST_AUDIT_MARKER);

  if (index === -1) {
    return '';
  }

  return body.slice(index).trim();
}

function buildAuditSection({
  rangeFrom,
  rangeTo,
  totalMerges,
  checkDocsPassed,
  danglingGroups,
  commentUrl,
}) {
  const lines = [
    LAST_AUDIT_MARKER,
    '',
    '## 마지막 경량 감사',
    '',
    '| 항목 | 값 |',
    '| --- | --- |',
    `| 실행 시각 | ${formatTimestamp()} UTC |`,
    `| 확인 범위 | \`${rangeFrom}..${rangeTo}\` (병합 PR ${totalMerges}개) |`,
    `| \`pnpm check:docs\` | ${checkDocsPassed ? '통과' : '실패'} |`,
    `| dangling | ${danglingGroups > 0 ? `${danglingGroups}건` : '없음'} |`,
  ];

  if (commentUrl) {
    lines.push(`| 리포트 | [댓글 보기](${commentUrl}) |`);
  }

  return lines.join('\n');
}

function buildBody(lastCheckedSha, mergesSinceAudit, auditSection) {
  const lines = [
    `<!-- doc-drift-state: last_checked_sha=${lastCheckedSha}, merges_since_audit=${mergesSinceAudit} -->`,
    '',
    '## 현재 상태',
    '',
    '| 항목 | 값 |',
    '| --- | --- |',
    `| 다음 경량 감사까지 | ${mergesSinceAudit}/${THRESHOLD} 병합 |`,
    `| 마지막 확인 커밋 | \`${lastCheckedSha.slice(0, 7)}\` |`,
    `| 마지막 갱신 | ${formatTimestamp()} UTC |`,
    '',
    '이 이슈는 자동화 워크플로(`doc-drift-check.yml`)가 상태를 기록하는 곳입니다. 마커 줄을 사람이 직접 편집하지 마세요.',
  ];

  if (auditSection) {
    lines.push('', auditSection);
  }

  return lines.join('\n');
}

function ensureLabel() {
  const labels = JSON.parse(
    gh(['label', 'list', '--repo', REPO, '--json', 'name', '--limit', '100'])
  );

  if (labels.some((label) => label.name === LABEL)) {
    return;
  }

  gh([
    'label',
    'create',
    LABEL,
    '--repo',
    REPO,
    '--color',
    'ededed',
    '--description',
    '자동 문서-코드 정합성 점검 트래커',
  ]);
}

function findOrCreateIssue(headSha) {
  const issues = JSON.parse(
    gh([
      'issue',
      'list',
      '--repo',
      REPO,
      '--label',
      LABEL,
      '--state',
      'open',
      '--json',
      'number,body',
      '--limit',
      '5',
    ])
  );

  if (issues.length > 0) {
    return { number: issues[0].number, body: issues[0].body, isNew: false };
  }

  ensureLabel();

  const body = buildBody(headSha, 0, '');
  const url = gh([
    'issue',
    'create',
    '--repo',
    REPO,
    '--title',
    ISSUE_TITLE,
    '--label',
    LABEL,
    '--body-file',
    tempFile(body),
  ]);
  const number = Number(url.split('/').pop());

  return { number, body, isNew: true };
}

function parseState(body) {
  const match = body.match(STATE_RE);

  if (!match) {
    return null;
  }

  return { lastCheckedSha: match[1], mergesSinceAudit: Number(match[2]) };
}

function countMergedPRs(fromSha, toSha) {
  const log = git(['log', '--pretty=format:%s', `${fromSha}..${toSha}`]);

  if (!log) {
    return { count: 0, subjects: [] };
  }

  const subjects = log.split('\n').filter((line) => MERGE_COMMIT_RE.test(line));

  return { count: subjects.length, subjects };
}

// diff에서 삭제된 export 식별자를 뽑는다. 완벽한 파서가 아니라 "export const/type/
// interface/function/class NAME" 패턴에 한정된 휴리스틱이다 — 이 정도로도 실제
// dangling import·타입 참조는 대부분 잡힌다.
const EXPORT_RE = /^-\s*export\s+(?:const|type|interface|function|class)\s+([A-Za-z0-9_]+)/;

function findDeletedIdentifiers(fromSha, toSha) {
  const diff = git(['diff', `${fromSha}..${toSha}`, '--', ...WATCHED_PATHS]);
  const identifiers = new Set();

  for (const line of diff.split('\n')) {
    const match = line.match(EXPORT_RE);

    if (match) {
      identifiers.add(match[1]);
    }
  }

  return [...identifiers];
}

function findDeletedFiles(fromSha, toSha) {
  const output = git(['diff', '--name-status', `${fromSha}..${toSha}`, '--', 'src/']);

  return output
    .split('\n')
    .filter((line) => line.startsWith('D\t'))
    .map((line) => line.split('\t')[1]);
}

function grepRepoWide(term) {
  try {
    const output = run('grep', [
      '-rn',
      '--include=*.ts',
      '--include=*.tsx',
      '--include=*.md',
      '--',
      term,
      'src',
      'docs',
      '.claude',
    ]);

    return output.split('\n').filter(Boolean);
  } catch (error) {
    // grep은 매치가 없으면 exit code 1로 실패 취급한다 — 이건 진짜 에러가 아니다.
    if (error.status === 1) {
      return [];
    }

    throw error;
  }
}

function runCheckDocs() {
  try {
    const output = run('node', ['scripts/check-docs.js']);

    return { passed: true, output };
  } catch (error) {
    const output = error.stdout ? error.stdout.toString() : String(error);

    return { passed: false, output };
  }
}

function commentOn(issueNumber, body) {
  return gh([
    'issue',
    'comment',
    String(issueNumber),
    '--repo',
    REPO,
    '--body-file',
    tempFile(body),
  ]);
}

function editBody(issueNumber, body) {
  gh(['issue', 'edit', String(issueNumber), '--repo', REPO, '--body-file', tempFile(body)]);
}

function buildDrifReportBody(
  state,
  headSha,
  totalMerges,
  subjects,
  checkDocsResult,
  danglingLines
) {
  const lines = [
    '⚠️ 이건 경량 grep 검사입니다 — 산문 서술·다이어그램처럼 의미적으로만 어긋나는 문서 오류' +
      '(줄 번호는 파일 범위 안인데 내용이 낡은 경우 등)는 이 검사로 못 잡습니다. 그런 종류가' +
      ' 의심되면 사람이 전체 subagent 감사를 요청해야 합니다.',
    '',
    `확인 범위: \`${state.lastCheckedSha.slice(0, 7)}..${headSha.slice(0, 7)}\` (병합 PR ${totalMerges}개)`,
  ];

  if (subjects.length > 0) {
    lines.push(subjects.map((subject) => `- ${subject}`).join('\n'));
  }

  lines.push('', `\`pnpm check:docs\`: ${checkDocsResult.passed ? '통과' : '실패'}`);

  if (!checkDocsResult.passed) {
    lines.push('```', checkDocsResult.output.slice(0, 3000), '```');
  }

  lines.push('');

  if (danglingLines.length > 0) {
    lines.push(`dangling reference 발견:`, ...danglingLines);
  } else {
    lines.push('dangling reference 없음.');
  }

  return lines.join('\n');
}

function runLightweightAudit(issue, state, headSha, totalMerges, subjects) {
  const checkDocsResult = runCheckDocs();
  const deletedIdentifiers = findDeletedIdentifiers(state.lastCheckedSha, headSha);
  const deletedFiles = findDeletedFiles(state.lastCheckedSha, headSha);
  const danglingLines = [];
  let danglingGroups = 0;

  for (const identifier of deletedIdentifiers) {
    const hits = grepRepoWide(identifier);

    if (hits.length === 0) {
      continue;
    }

    danglingGroups += 1;
    danglingLines.push(`- \`${identifier}\`(삭제된 export) — ${hits.length}건 참조 남음:`);
    hits.slice(0, 10).forEach((hit) => danglingLines.push(`  - ${hit}`));
  }

  for (const file of deletedFiles) {
    const hits = grepRepoWide(file);

    if (hits.length === 0) {
      continue;
    }

    danglingGroups += 1;
    danglingLines.push(`- \`${file}\`(삭제된 파일 경로) — ${hits.length}건 참조 남음:`);
    hits.slice(0, 10).forEach((hit) => danglingLines.push(`  - ${hit}`));
  }

  const reportBody = buildDrifReportBody(
    state,
    headSha,
    totalMerges,
    subjects,
    checkDocsResult,
    danglingLines
  );

  const commentUrl = commentOn(issue.number, reportBody);
  const auditSection = buildAuditSection({
    rangeFrom: state.lastCheckedSha.slice(0, 7),
    rangeTo: headSha.slice(0, 7),
    totalMerges,
    checkDocsPassed: checkDocsResult.passed,
    danglingGroups,
    commentUrl,
  });

  editBody(issue.number, buildBody(headSha, 0, auditSection));
  console.log(`경량 감사 완료 — dangling ${danglingGroups}건.`);
}

function main() {
  if (!REPO) {
    throw new Error(
      'GITHUB_REPOSITORY 환경변수가 없습니다 — GitHub Actions 안에서만 실행할 수 있습니다.'
    );
  }

  git(['fetch', 'origin', 'main', '--quiet']);
  const headSha = git(['rev-parse', 'origin/main']);

  const issue = findOrCreateIssue(headSha);

  if (issue.isNew) {
    console.log(`트래킹 이슈 새로 생성: #${issue.number}`);
    return;
  }

  const state = parseState(issue.body);

  if (!state) {
    console.log('이슈 본문에서 상태 마커를 못 찾음 — 지금 HEAD로 재초기화합니다.');
    editBody(issue.number, buildBody(headSha, 0, extractAuditSection(issue.body)));
    return;
  }

  if (state.lastCheckedSha === headSha) {
    console.log('마지막 확인 이후 새 커밋 없음 — 종료.');
    return;
  }

  const { count: newMerges, subjects } = countMergedPRs(state.lastCheckedSha, headSha);
  const totalMerges = state.mergesSinceAudit + newMerges;

  if (totalMerges < THRESHOLD) {
    editBody(issue.number, buildBody(headSha, totalMerges, extractAuditSection(issue.body)));
    console.log(`기준 미달(${totalMerges}/${THRESHOLD}) — 검사 없이 상태만 갱신.`);
    return;
  }

  runLightweightAudit(issue, state, headSha, totalMerges, subjects);
}

main();
