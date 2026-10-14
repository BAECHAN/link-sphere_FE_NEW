// `pnpm check:cloudfront [-- --write]`
//
// CloudFront 배포 설정(캐시 정책·Function 연결·OAC·도메인·WAF)은 콘솔·CLI로만 바꾸고 이 레포 코드로는
// 배포되지 않는다(docs/DEPLOY.md "CloudFront 설정 스냅샷과 차이 검사"). 그래서 누가 무엇을 바꿨는지 git에
// 남지 않는다. 이 스크립트는 지금 설정을 읽어 커밋된 스냅샷(infra/cloudfront/snapshot.json)과 비교하고,
// 배포된 CloudFront Function 코드가 infra/cloudfront-functions/의 파일과 같은지도 확인한다.
//   - 기본: 다르면 차이를 출력하고 exit 1
//   - --write: 스냅샷 파일을 지금 설정으로 갱신(콘솔에서 바꾼 뒤 같은 PR로 커밋한다)
// 읽기 전용 호출(get-*·list-*·describe-*)만 하고, 로컬 AWS 자격증명으로 실행한다 - CI 배포 역할에는 아직
// 읽기 권한이 없다(docs/DEPLOY.md "AWS IAM 권한 요구사항"). 마스킹·비교 규칙은 lib/cloudfront-snapshot.js.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FUNCTION_NAME_PREFIX,
  SNAPSHOT_PATH,
  buildSnapshot,
  diffSnapshots,
} from './lib/cloudfront-snapshot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALIAS = 'linksphere.click';
// CloudFront용 WAF는 리전이 us-east-1로 고정이다
const WAF_REGION = 'us-east-1';

function aws(args) {
  const output = execFileSync('aws', [...args, '--output', 'json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return output.trim() ? JSON.parse(output) : {};
}

function findDistributionId() {
  const items = aws(['cloudfront', 'list-distributions']).DistributionList?.Items ?? [];
  const distribution = items.find(({ Aliases }) => Aliases?.Items?.includes(ALIAS));

  if (!distribution) {
    throw new Error(`별칭 ${ALIAS}이 붙은 배포를 찾지 못했다`);
  }

  return distribution.Id;
}

function behaviorsOf(distributionConfig) {
  return [
    distributionConfig.DefaultCacheBehavior,
    ...(distributionConfig.CacheBehaviors?.Items ?? []),
  ];
}

function readPolicies(distributionConfig) {
  const cachePolicies = {};
  const originRequestPolicies = {};

  for (const { CachePolicyId, OriginRequestPolicyId } of behaviorsOf(distributionConfig)) {
    if (CachePolicyId && !cachePolicies[CachePolicyId]) {
      cachePolicies[CachePolicyId] = aws([
        'cloudfront',
        'get-cache-policy',
        '--id',
        CachePolicyId,
      ]).CachePolicy.CachePolicyConfig;
    }

    if (OriginRequestPolicyId && !originRequestPolicies[OriginRequestPolicyId]) {
      originRequestPolicies[OriginRequestPolicyId] = aws([
        'cloudfront',
        'get-origin-request-policy',
        '--id',
        OriginRequestPolicyId,
      ]).OriginRequestPolicy.OriginRequestPolicyConfig;
    }
  }

  return { cachePolicies, originRequestPolicies };
}

/** 배포된(LIVE) 코드를 받는다. get-function은 코드를 파일로 쓰고 메타데이터 JSON을 stdout에 낸다 */
function readLiveFunctionCode(name, tempDir) {
  const outFile = path.join(tempDir, `${name}.js`);
  execFileSync('aws', ['cloudfront', 'get-function', '--name', name, '--stage', 'LIVE', outFile], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  return fs.readFileSync(outFile);
}

function readFunctions(distributionConfig, tempDir) {
  const associations = behaviorsOf(distributionConfig).flatMap(
    (behavior) => behavior.FunctionAssociations?.Items ?? []
  );

  return associations.map(({ FunctionARN, EventType }) => {
    const name = FunctionARN.split('function/')[1];
    const { FunctionConfig } = aws([
      'cloudfront',
      'describe-function',
      '--name',
      name,
      '--stage',
      'LIVE',
    ]).FunctionSummary;
    const repoFile = `infra/cloudfront-functions/${name.replace(FUNCTION_NAME_PREFIX, '')}.js`;
    const repoPath = path.join(ROOT, repoFile);
    const repoExists = fs.existsSync(repoPath);

    return {
      Name: name,
      EventType,
      Runtime: FunctionConfig.Runtime,
      Comment: FunctionConfig.Comment,
      RepoFile: repoExists ? repoFile : null,
      CodeMatchesRepo:
        repoExists && readLiveFunctionCode(name, tempDir).equals(fs.readFileSync(repoPath)),
    };
  });
}

function readWebAcl(distributionConfig) {
  // arn:aws:wafv2:us-east-1:<계정>:global/webacl/<이름>/<ID>
  const arn = distributionConfig.WebACLId;

  if (!arn) {
    return null;
  }

  const [name, id] = arn.split('/webacl/')[1].split('/');

  return aws([
    'wafv2',
    'get-web-acl',
    '--scope',
    'CLOUDFRONT',
    '--region',
    WAF_REGION,
    '--name',
    name,
    '--id',
    id,
  ]).WebACL;
}

function readSnapshot() {
  const distributionId = findDistributionId();
  const distributionConfig = aws([
    'cloudfront',
    'get-distribution-config',
    '--id',
    distributionId,
  ]).DistributionConfig;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudfront-functions-'));

  try {
    return buildSnapshot({
      distributionId,
      distributionConfig,
      ...readPolicies(distributionConfig),
      functions: readFunctions(distributionConfig, tempDir),
      webAcl: readWebAcl(distributionConfig),
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const write = process.argv.slice(2).includes('--write');
  const snapshotPath = path.join(ROOT, SNAPSHOT_PATH);
  const actual = readSnapshot();

  if (write) {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, `${JSON.stringify(actual, null, 2)}\n`);
    console.log(`[check-cloudfront] ${SNAPSHOT_PATH}를 지금 설정으로 갱신했다`);
    return;
  }

  const expected = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const differences = diffSnapshots(expected, actual);
  const mismatchedFunctions = actual.functions.filter(({ CodeMatchesRepo }) => !CodeMatchesRepo);

  if (differences.length === 0 && mismatchedFunctions.length === 0) {
    console.log('[check-cloudfront] 커밋된 스냅샷과 지금 설정이 같다');
    return;
  }

  for (const difference of differences) {
    console.log(`  - ${difference}`);
  }

  // Function 코드 차이는 스냅샷을 갱신해도 사라지지 않는다 - 레포 파일과 배포된 코드를 맞춰야 한다
  for (const { Name, RepoFile } of mismatchedFunctions) {
    console.log(
      `  - Function ${Name}: 배포된 코드가 ${RepoFile ?? '(레포 파일 없음)'}와 다르다 - ` +
        'docs/DEPLOY.md "CloudFront Function" 절차로 배포하거나 레포 파일을 고친다'
    );
  }

  throw new Error(
    '차이가 있다 - 콘솔 변경이 의도한 것이면 `pnpm check:cloudfront --write`로 스냅샷을 갱신해 커밋하고, 아니면 되돌린다'
  );
}

try {
  main();
} catch (error) {
  console.error(`[check-cloudfront] 실패: ${error.message}`);
  process.exit(1);
}
