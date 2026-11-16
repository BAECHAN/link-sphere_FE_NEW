// `node scripts/precompress-assets.js`
//
// deploy.yml "사전 압축" 스텝이 빌드 뒤에 실행한다. dist/assets의 .js·.css를 brotli 최고 단계(11)로 눌러
// 원본 옆에 <파일>.br로 둔다. CloudFront의 실시간 brotli는 이보다 약 10% 덜 줄인다(2026-11-16 직접 측정,
// docs/PERFORMANCE.md "사전 brotli 압축"). br을 받는 요청은 CloudFront Function(spa-fallback.js)이 .br
// 주소로 보내고, 나머지는 원본을 CloudFront가 지금처럼 실시간 압축한다.
//
// `pnpm build`에 넣지 않은 이유: 로컬 빌드·e2e·Lighthouse CI는 이 파일을 쓰지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { BROTLI_SUFFIX, findMissingPairs, isPrecompressTarget } from './lib/precompress-assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ASSETS = path.join(DIST, 'assets');

/** dist/assets 아래 파일을 dist/ 상대 경로(assets/js/a.js)로 모은다 */
function readAssetKeys() {
  if (!fs.existsSync(ASSETS)) {
    throw new Error('dist/assets가 없다 - 빌드 뒤에 실행해야 한다');
  }

  return fs
    .readdirSync(ASSETS, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(DIST, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')
    );
}

function main() {
  const targets = readAssetKeys().filter(isPrecompressTarget);
  let originalBytes = 0;
  let compressedBytes = 0;

  for (const key of targets) {
    const source = fs.readFileSync(path.join(DIST, key));
    const compressed = zlib.brotliCompressSync(source, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    });

    fs.writeFileSync(path.join(DIST, key + BROTLI_SUFFIX), compressed);
    originalBytes += source.length;
    compressedBytes += compressed.length;
  }

  // 방금 쓴 결과를 디스크에서 다시 읽어 확인한다 - 짝이 빠진 채 올라가면 그 파일은 br 브라우저에서 403이다
  const missing = findMissingPairs(readAssetKeys());

  if (targets.length === 0 || missing.length > 0) {
    throw new Error(
      `사전 압축 짝 확인 실패 - 대상 ${targets.length}개, 짝 없음 ${missing.length}개` +
        (missing.length > 0 ? ` (첫 항목: ${missing[0]})` : '')
    );
  }

  console.log(
    `[precompress-assets] ${targets.length}개: 원본 ${originalBytes}바이트 → brotli ${compressedBytes}바이트`
  );
}

try {
  main();
} catch (error) {
  console.error(`[precompress-assets] 실패: ${error.message}`);
  process.exit(1);
}
