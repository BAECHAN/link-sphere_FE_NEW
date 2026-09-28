// vite build 이후 dist/index.html에 CSP를 <meta http-equiv> 태그로 주입한다
// (docs/plans/2026-09-29-oac-lockdown.md FE Phase 6). index.html의 인라인 <script>
// (src 없는 것, 정확히 2개 - RUM 로더·테마 FOUC 방지 스크립트) 내용을 그대로 SHA256
// 해시해 script-src 허용 목록에 넣는다. 더 강력하고 meta 태그로 못 넣는 지시어
// (frame-ancestors 등)는 CloudFront 응답 헤더 정책으로 별도 적용한다(docs/DEPLOY.md
// "CloudFront 응답 헤더 정책" 절 참고, 이 스크립트의 범위 밖).
//
// vite-plugin-compression이 vite build 도중 CSP 주입 "전" index.html을 이미
// index.html.gz로 압축해둔다 - 하지만 deploy.yml이 index.html은 그 gz를 거치지 않고
// dist/index.html을 직접 S3에 업로드하므로(일반 sync에서도 "index.html"만 제외라
// index.html.gz는 실제로 서빙되진 않는다) 서빙 정확성 문제는 없다. 다만 죽은 채로
// 업로드되는 걸 막기 위해 아래에서 지운다.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'dist/index.html');
const EXPECTED_INLINE_SCRIPT_COUNT = 2;

/** src 없는 인라인 <script>...</script> 블록의 내용만 추출한다. */
function extractInlineScriptContents(html) {
  const pattern = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const contents = [];
  let match;

  while ((match = pattern.exec(html)) !== null) {
    contents.push(match[1]);
  }

  return contents;
}

function hashScript(content) {
  return `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`;
}

function buildCsp(scriptHashes) {
  return [
    `default-src 'self'`,
    `script-src 'self' ${scriptHashes.join(' ')} https://client.rum.us-east-1.amazonaws.com`,
    `connect-src 'self' https://dataplane.rum.ap-northeast-1.amazonaws.com https://*.supabase.co`,
    `img-src 'self' data: https:`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
  ].join('; ');
}

function main() {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const scriptContents = extractInlineScriptContents(html);

  if (scriptContents.length !== EXPECTED_INLINE_SCRIPT_COUNT) {
    throw new Error(
      `index.html에서 인라인 <script> ${EXPECTED_INLINE_SCRIPT_COUNT}개(RUM 로더, 테마 FOUC 방지)를 기대했지만 ${scriptContents.length}개를 찾았다 - index.html이 바뀌었다면 이 스크립트의 CSP script-src도 함께 갱신해야 한다.`
    );
  }

  const csp = buildCsp(scriptContents.map(hashScript));
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${csp}" />\n  </head>`;
  const updatedHtml = html.replace('</head>', metaTag);

  if (updatedHtml === html) {
    throw new Error('index.html에서 </head>를 찾지 못해 CSP meta 태그를 주입하지 못했다.');
  }

  fs.writeFileSync(INDEX_PATH, updatedHtml, 'utf8');

  const staleGzipPath = `${INDEX_PATH}.gz`;
  if (fs.existsSync(staleGzipPath)) {
    fs.unlinkSync(staleGzipPath);
  }

  console.log(
    `[inject-csp] CSP meta 태그 주입 완료 (인라인 스크립트 해시 ${scriptContents.length}개)`
  );
}

try {
  main();
} catch (error) {
  console.error(`[inject-csp] 실패: ${error.message}`);
  process.exit(1);
}
