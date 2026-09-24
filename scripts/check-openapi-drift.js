// 커밋된 src/shared/api/generated/openapi.json 이 지금 운영에서 실제로 서빙되는 BE
// 스펙과 같은지 cron으로 확인해 GitHub 이슈에 보고한다. ci.yml의 "생성 타입 최신성
// 확인" 스텝(pnpm codegen 재실행 대조)은 네트워크를 안 써서 "커밋된 json → ts가
// 일치하는가"만 보고, "커밋된 json 자체가 아직 운영과 같은가"는 못 본다 — 그건 BE가
// 배포될 때만 벌어지는 일이라 PR 타이밍과 무관하게 별도로 확인해야 한다. PR 게이트에
// 넣지 않는 이유: BE 배포 시점에 따라 무관한 FE PR의 CI가 오탐으로 빨개지기 때문
// (doc-drift-check.yml과 같은 이유로 "레포에 쓰지 않고 트래킹 이슈로만 보고" 패턴을
// 그대로 따른다).
//
// 운영 스펙은 CloudFront 공개 도메인(README.md에 이미 공개된 https://dbw3brui6htwk.
// cloudfront.net)의 /api/v3/api-docs 에서 가져온다 — 로컬 dev용 .env의 Lambda Function
// URL 직결 경로 대신 실제 사용자가 거치는 CloudFront+WAF 경로를 그대로 확인한다. 별도
// 시크릿이 필요 없다(이미 공개된 값).
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { normalizeOpenApiSpec } from './lib/openapi-spec.js';

const REPO = process.env.GITHUB_REPOSITORY;
const LABEL = 'openapi-drift-check';
const ISSUE_TITLE = '[자동] BE OpenAPI 스펙 드리프트 감지';
const PROD_SPEC_URL = 'https://dbw3brui6htwk.cloudfront.net/api/v3/api-docs';
const COMMITTED_SPEC_PATH = 'src/shared/api/generated/openapi.json';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

function tempFile(content) {
  const dir = mkdtempSync(join(tmpdir(), 'openapi-drift-'));
  const file = join(dir, 'body.md');

  writeFileSync(file, content, 'utf8');

  return file;
}

async function fetchProdSpec() {
  const response = await fetch(PROD_SPEC_URL);

  if (!response.ok) {
    throw new Error(`운영 스펙 요청 실패: HTTP ${response.status} ${PROD_SPEC_URL}`);
  }

  return normalizeOpenApiSpec(await response.json());
}

function readCommittedSpec() {
  return normalizeOpenApiSpec(JSON.parse(readFileSync(COMMITTED_SPEC_PATH, 'utf8')));
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
    '자동 BE OpenAPI 스펙 드리프트 감지 트래커',
  ]);
}

function findOpenIssue() {
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
      'number',
      '--limit',
      '1',
    ])
  );

  return issues[0] ?? null;
}

/**
 * paths/components.schemas의 추가·삭제된 키뿐 아니라, 양쪽에 공통으로 존재하는 키의
 * 내용 차이(JSON.stringify 비교)와 paths/components를 제외한 나머지 최상위 필드
 * (tags/info/security 등)의 차이까지 항상 함께 사람이 읽을 줄로 요약한다. 입력은 이미
 * sortKeysDeep으로 정규화돼 있어 키 순서 차이로 인한 오탐은 없다.
 */
function summarizeDrift(committed, prod) {
  const committedPaths = committed.paths ?? {};
  const prodPaths = prod.paths ?? {};
  const committedSchemas = committed.components?.schemas ?? {};
  const prodSchemas = prod.components?.schemas ?? {};

  const committedPathKeys = new Set(Object.keys(committedPaths));
  const prodPathKeys = new Set(Object.keys(prodPaths));
  const committedSchemaKeys = new Set(Object.keys(committedSchemas));
  const prodSchemaKeys = new Set(Object.keys(prodSchemas));

  const added = (from, to) => [...to].filter((key) => !from.has(key));
  const removed = (from, to) => [...from].filter((key) => !to.has(key));

  const changed = (from, to) =>
    Object.keys(from).filter(
      (key) => key in to && JSON.stringify(from[key]) !== JSON.stringify(to[key])
    );

  const lines = [];
  const addedPaths = added(committedPathKeys, prodPathKeys);
  const removedPaths = removed(committedPathKeys, prodPathKeys);
  const changedPaths = changed(committedPaths, prodPaths);
  const addedSchemas = added(committedSchemaKeys, prodSchemaKeys);
  const removedSchemas = removed(committedSchemaKeys, prodSchemaKeys);
  const changedSchemas = changed(committedSchemas, prodSchemas);

  if (addedPaths.length > 0) {
    lines.push(`운영에 새로 생긴 paths: ${addedPaths.join(', ')}`);
  }

  if (removedPaths.length > 0) {
    lines.push(`운영에서 사라진 paths: ${removedPaths.join(', ')}`);
  }

  if (changedPaths.length > 0) {
    lines.push(`내용이 달라진 paths: ${changedPaths.join(', ')}`);
  }

  if (addedSchemas.length > 0) {
    lines.push(`운영에 새로 생긴 schemas: ${addedSchemas.join(', ')}`);
  }

  if (removedSchemas.length > 0) {
    lines.push(`운영에서 사라진 schemas: ${removedSchemas.join(', ')}`);
  }

  if (changedSchemas.length > 0) {
    lines.push(`내용이 달라진 schemas: ${changedSchemas.join(', ')}`);
  }

  const topLevelKeys = new Set([...Object.keys(committed), ...Object.keys(prod)]);
  const changedTopLevelKeys = [...topLevelKeys]
    .filter((key) => key !== 'paths' && key !== 'components')
    .filter((key) => JSON.stringify(committed[key]) !== JSON.stringify(prod[key]));

  if (changedTopLevelKeys.length > 0) {
    lines.push(`그 외 최상위 필드도 다릅니다: ${changedTopLevelKeys.join(', ')}`);
  }

  if (lines.length === 0) {
    lines.push(
      'paths/schemas와 최상위 필드는 같지만 전체 스펙은 다릅니다(components의 schemas 외 하위 필드 등).'
    );
  }

  return lines;
}

function buildIssueBody(driftLines) {
  return [
    `커밋된 \`${COMMITTED_SPEC_PATH}\` 이 운영 BE 스펙(${PROD_SPEC_URL})과 다릅니다.`,
    '',
    ...driftLines.map((line) => `- ${line}`),
    '',
    '해결: `pnpm codegen:fetch && pnpm codegen` 을 실행해 스펙을 갱신하는 PR을 올리세요.',
    '이 이슈는 openapi-drift-check.yml(cron)이 관리합니다 — 다음 실행에서 드리프트가',
    '해소되면 자동으로 닫힙니다.',
  ].join('\n');
}

async function main() {
  if (!REPO) {
    throw new Error(
      'GITHUB_REPOSITORY 환경변수가 없습니다 — GitHub Actions 안에서만 실행할 수 있습니다.'
    );
  }

  const prodSpec = await fetchProdSpec();
  const committedSpec = readCommittedSpec();
  const inSync = JSON.stringify(prodSpec) === JSON.stringify(committedSpec);
  const existingIssue = findOpenIssue();

  if (inSync) {
    if (existingIssue) {
      gh([
        'issue',
        'close',
        String(existingIssue.number),
        '--repo',
        REPO,
        '--comment',
        '운영 스펙과 다시 일치합니다 — 자동으로 닫습니다.',
      ]);
      console.log(`드리프트 해소 확인 — 이슈 #${existingIssue.number} 닫음.`);
    } else {
      console.log('드리프트 없음.');
    }

    return;
  }

  const driftLines = summarizeDrift(committedSpec, prodSpec);

  if (existingIssue) {
    console.log(`드리프트 지속 중 — 이미 열려 있는 이슈 #${existingIssue.number}, 재보고 생략.`);
    return;
  }

  ensureLabel();

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
    tempFile(buildIssueBody(driftLines)),
  ]);

  console.log(`드리프트 발견 — 이슈 생성: ${url}`);
}

main().catch((error) => {
  console.error(`[check-openapi-drift] 실패: ${error.message}`);
  process.exit(1);
});
