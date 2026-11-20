// `node scripts/deploy-cloudfront-functions.js --prepare | --publish`
//
// deploy.yml이 infra/cloudfront-functions/의 Function을 배포할 때 쓴다(docs/DEPLOY.md "CloudFront Function").
// 배포된(LIVE) 코드가 레포 파일과 다른 Function만 다룬다 - 평소 배포에서는 비교만 하고 끝난다.
//   - --prepare: 개발(DEVELOPMENT) 단계에 레포 파일을 올리고 test-cases.json의 케이스를 실제 런타임에서 전부
//     돌린다. 하나라도 어긋나면 exit 1. S3 업로드보다 먼저 실행해, 실패하면 아무것도 공개되기 전에 멈춘다.
//   - --publish: 준비된 코드를 LIVE로 게시하고 LIVE가 레포 파일과 같아졌는지 확인한다. S3 업로드 뒤에 실행한다 -
//     Function은 S3의 파일(.br 사본, /404.html)을 전제로 하기 때문이다.
// 순서는 test-cases.json의 배열 순서다. Comment·Runtime은 LIVE 값을 그대로 다시 넣는다(설정은 이 스크립트 범위가
// 아니고 infra/cloudfront/snapshot.json이 감시한다). 배포 역할의 권한은 infra 저장소의 FeDeployRole에 있다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TEST_CASES_PATH,
  buildTestEvent,
  findMismatches,
} from './lib/cloudfront-function-deploy.js';
import { FUNCTION_NAME_PREFIX } from './lib/cloudfront-snapshot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS_DIR = path.join(ROOT, path.dirname(TEST_CASES_PATH));

function aws(args) {
  const output = execFileSync('aws', [...args, '--output', 'json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return output.trim() ? JSON.parse(output) : {};
}

/** 그 단계의 코드를 받는다. get-function은 코드를 파일로 쓰고 메타데이터 JSON을 stdout에 낸다 */
function readFunctionCode(name, stage, tempDir) {
  const outFile = path.join(tempDir, `${name}.${stage}.js`);
  execFileSync('aws', ['cloudfront', 'get-function', '--name', name, '--stage', stage, outFile], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  return fs.readFileSync(outFile);
}

/** LIVE 코드가 레포 파일과 다른 Function만 고른다 */
function findChangedSuites(tempDir) {
  const suites = JSON.parse(fs.readFileSync(path.join(ROOT, TEST_CASES_PATH), 'utf8'));

  return suites
    .map((suite) => ({
      ...suite,
      name: FUNCTION_NAME_PREFIX + path.basename(suite.file, '.js'),
      repoPath: path.join(FUNCTIONS_DIR, suite.file),
    }))
    .filter(({ name, repoPath }) => {
      const changed = !readFunctionCode(name, 'LIVE', tempDir).equals(fs.readFileSync(repoPath));

      if (!changed) {
        console.log(`[deploy-functions] ${name}: 배포된 코드가 레포 파일과 같다 - 건너뜀`);
      }

      return changed;
    });
}

function describe(name, stage) {
  return aws(['cloudfront', 'describe-function', '--name', name, '--stage', stage]);
}

function prepare({ name, repoPath, eventType, cases }, tempDir) {
  if (cases.length === 0) {
    throw new Error(`${name}: 시험 케이스가 없다 - ${TEST_CASES_PATH}에 추가한다`);
  }

  // 설정은 LIVE 값을 넣는다 - 스냅샷과 매일 차이 검사가 보는 쪽이다. ETag는 고칠 대상인 개발 단계 것이다
  const { Comment, Runtime } = describe(name, 'LIVE').FunctionSummary.FunctionConfig;
  const current = describe(name, 'DEVELOPMENT');
  const updated = aws([
    'cloudfront',
    'update-function',
    '--name',
    name,
    '--if-match',
    current.ETag,
    '--function-config',
    JSON.stringify({ Comment, Runtime }),
    '--function-code',
    `fileb://${repoPath}`,
  ]);
  const eventFile = path.join(tempDir, `${name}.event.json`);
  const failures = [];

  for (const testCase of cases) {
    fs.writeFileSync(eventFile, JSON.stringify(buildTestEvent(eventType, testCase)));

    const { TestResult } = aws([
      'cloudfront',
      'test-function',
      '--name',
      name,
      '--if-match',
      updated.ETag,
      '--stage',
      'DEVELOPMENT',
      '--event-object',
      `fileb://${eventFile}`,
    ]);
    const label = `${testCase.uri} (accept-encoding: ${testCase.acceptEncoding ?? '없음'}, user-agent: ${testCase.userAgent ?? '없음'})`;

    if (TestResult.FunctionErrorMessage) {
      failures.push(`${label}: 실행 오류 ${TestResult.FunctionErrorMessage}`);
      continue;
    }

    for (const mismatch of findMismatches(testCase, JSON.parse(TestResult.FunctionOutput))) {
      failures.push(`${label}: ${mismatch}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `${name}: test-function ${failures.length}건 실패 - LIVE는 바꾸지 않았다\n  ${failures.join('\n  ')}`
    );
  }

  console.log(`[deploy-functions] ${name}: 개발 단계에 올리고 케이스 ${cases.length}개 통과`);
}

function publish({ name, repoPath }, tempDir) {
  const repoCode = fs.readFileSync(repoPath);

  if (!readFunctionCode(name, 'DEVELOPMENT', tempDir).equals(repoCode)) {
    throw new Error(`${name}: 개발 단계 코드가 레포 파일과 다르다 - --prepare가 먼저 돌아야 한다`);
  }

  aws([
    'cloudfront',
    'publish-function',
    '--name',
    name,
    '--if-match',
    describe(name, 'DEVELOPMENT').ETag,
  ]);

  if (!readFunctionCode(name, 'LIVE', tempDir).equals(repoCode)) {
    throw new Error(`${name}: 게시했는데 LIVE 코드가 레포 파일과 다르다`);
  }

  console.log(`[deploy-functions] ${name}: LIVE로 게시했다`);
}

function main() {
  const mode = process.argv[2];
  const run = { '--prepare': prepare, '--publish': publish }[mode];

  if (!run) {
    throw new Error('--prepare 또는 --publish 중 하나를 준다');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudfront-function-deploy-'));

  try {
    for (const suite of findChangedSuites(tempDir)) {
      run(suite, tempDir);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`[deploy-functions] 실패: ${error.message}`);
  process.exit(1);
}
