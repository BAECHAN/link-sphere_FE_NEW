// `node scripts/prune-old-assets.js --bucket <버킷> [--dry-run]`
//
// deploy.yml "옛 자산 정리" 스텝이 배포 반영 검증 뒤에 실행한다. 배포는 열린 탭을 위해 옛 해시
// 청크를 지우지 않는데(docs/DEPLOY.md 6번), 그대로 두면 무기한 쌓인다(2026-10-14 실측: assets
// 14,679개·119MB, entry 청크 624개). 지금 빌드에 없고 마지막 업로드가 7일 넘은 assets/·fonts/
// 객체만 지운다 - 선별 규칙은 lib/prune-assets.js.
//
// S3 lifecycle 규칙(날짜만 봄)을 쓰지 않는 이유: 배포가 7일 끊기면 지금 쓰는 파일까지 지운다.
// --dry-run은 지우지 않고 대상만 출력한다(머지 전 로컬 확인용, 읽기 전용).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dayjs from 'dayjs';
import { PRUNE_PREFIXES, RETENTION_DAYS, selectPrunableKeys } from './lib/prune-assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DELETE_BATCH_SIZE = 1000; // delete-objects 한 번에 최대 1,000개(S3 API 한도)

function parseArgs(argv) {
  const bucketIndex = argv.indexOf('--bucket');
  const bucket = bucketIndex === -1 ? undefined : argv[bucketIndex + 1];

  if (!bucket) {
    throw new Error('--bucket <버킷 이름>이 필요하다');
  }

  return { bucket, dryRun: argv.includes('--dry-run') };
}

/** dist/ 아래 정리 대상 접두사 폴더의 파일을 S3 키 형태(assets/js/a.js)로 모은다 */
function readCurrentKeys() {
  const keys = new Set();

  for (const prefix of PRUNE_PREFIXES) {
    const dir = path.join(DIST, prefix);

    if (!fs.existsSync(dir)) {
      continue;
    }

    for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) {
        keys.add(
          path.relative(DIST, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')
        );
      }
    }
  }

  return keys;
}

function aws(args) {
  return execFileSync('aws', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** CLI가 페이지를 알아서 이어 받아 Contents 전체를 돌려준다 */
function listObjects(bucket, prefix) {
  const output = aws([
    's3api',
    'list-objects-v2',
    '--bucket',
    bucket,
    '--prefix',
    prefix,
    '--output',
    'json',
  ]);

  return output.trim() ? (JSON.parse(output).Contents ?? []) : [];
}

function deleteKeys(bucket, keys) {
  for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
    const batch = keys.slice(start, start + DELETE_BATCH_SIZE);
    const payload = JSON.stringify({ Objects: batch.map((Key) => ({ Key })), Quiet: true });
    const output = aws([
      's3api',
      'delete-objects',
      '--bucket',
      bucket,
      '--delete',
      payload,
      '--output',
      'json',
    ]);
    const errors = output.trim() ? (JSON.parse(output).Errors ?? []) : [];

    if (errors.length > 0) {
      throw new Error(`삭제 실패 ${errors.length}건 - 첫 항목: ${JSON.stringify(errors[0])}`);
    }
  }
}

function main() {
  const { bucket, dryRun } = parseArgs(process.argv.slice(2));
  const currentKeys = readCurrentKeys();

  // 빌드 결과가 없으면 "지금 쓰는 파일" 목록이 비어 판단 근거가 없다 - 아무것도 지우지 않는다
  if (![...currentKeys].some((key) => key.startsWith('assets/'))) {
    throw new Error('dist/assets가 비어 있다 - 빌드 뒤에 실행해야 한다');
  }

  const objects = PRUNE_PREFIXES.flatMap((prefix) => listObjects(bucket, prefix));
  const prunable = selectPrunableKeys(objects, currentKeys, dayjs());

  console.log(
    `[prune-old-assets] 대상 접두사 객체 ${objects.length}개, 지금 빌드 ${currentKeys.size}개, ` +
      `보존 ${RETENTION_DAYS}일 지난 옛 자산 ${prunable.length}개${dryRun ? ' (dry-run - 지우지 않음)' : ''}`
  );

  if (dryRun) {
    for (const key of prunable.slice(0, 20)) {
      console.log(`  - ${key}`);
    }

    return;
  }

  deleteKeys(bucket, prunable);
  console.log(`[prune-old-assets] ${prunable.length}개 삭제 완료`);
}

try {
  main();
} catch (error) {
  console.error(`[prune-old-assets] 실패: ${error.message}`);
  process.exit(1);
}
