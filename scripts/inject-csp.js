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
    // dataplane.rum·supabase는 RUM 전송·업로드 서명 URL. firebaseinstallations·
    // fcmregistrations는 로그인 직후 호출되는 firebase/messaging의 getToken()이
    // SDK 내부에서 직접 부르는 Firebase Installations/FCM 등록 API 도메인이다
    // (Firebase Web SDK 공식 동작 - https://firebase.google.com/docs/cloud-messaging/js/client
    // 는 이 도메인을 명시하진 않지만, SDK 소스에서 고정된 엔드포인트다). 빠지면
    // 로그인마다 FCM 토큰 등록이 CSP로 조용히 막힌다(fcm.ts의 catch가 콘솔 로그만
    // 남겨 겉으로 드러나지 않는다) - pr-review-toolkit 리뷰에서 발견.
    `connect-src 'self' https://dataplane.rum.ap-northeast-1.amazonaws.com https://*.supabase.co https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com`,
    // blob:은 업로드 전 미리보기 - 댓글 첨부 썸네일(useImageAttachments)·낙관적 댓글
    // 이미지(comment.queries)·프로필 사진 미리보기(useUpdateAccount)가 모두
    // URL.createObjectURL로 만든 blob: URL을 <img>에 넣는다. 처음 주입할 때(#242) 빠져
    // 운영에서만 이 썸네일들이 깨졌다 - dev·e2e는 CSP를 주입하지 않아 안 드러났다(2026-10-02).
    `img-src 'self' data: blob: https:`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
  ].join('; ');
}

function main() {
  // Lighthouse CI(.github/workflows/ci.yml)는 VITE_API_BASE_URL을 운영 API
  // (https://linksphere.click/api, 교차 출처)로 가리켜 데이터가 채워진 화면을 측정한다 - connect-src 'self'인
  // CSP를 주입하면 그 호출이 전부 막혀 빈 화면을 측정하게 된다(pr-review-toolkit
  // 리뷰에서 발견). 실제 배포(deploy.yml)는 VITE_API_BASE_URL을 안 정해 같은 출처
  // (/api)로만 호출하므로 이 문제가 없다 - Lighthouse job에서만 건너뛴다.
  if (process.env.SKIP_CSP_INJECTION === '1') {
    console.log('[inject-csp] SKIP_CSP_INJECTION=1 - CSP 주입을 건너뜁니다');
    return;
  }

  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const scriptContents = extractInlineScriptContents(html);

  if (scriptContents.length !== EXPECTED_INLINE_SCRIPT_COUNT) {
    throw new Error(
      `index.html에서 인라인 <script> ${EXPECTED_INLINE_SCRIPT_COUNT}개(RUM 로더, 테마 FOUC 방지)를 기대했지만 ${scriptContents.length}개를 찾았다 - index.html이 바뀌었다면 이 스크립트의 CSP script-src도 함께 갱신해야 한다.`
    );
  }

  const csp = buildCsp(scriptContents.map(hashScript));
  // <meta charset> 바로 뒤에 넣는다 - meta CSP는 파서가 그 태그를 만난 "이후"
  // 콘텐츠에만 적용되므로, </head> 앞(RUM 로더·테마 스크립트보다 뒤)에 넣으면 두
  // 인라인 스크립트가 정책 적용 전에 이미 실행돼 해시 허용 목록이 사실상 아무것도
  // 검증하지 못한다(pr-review-toolkit 리뷰에서 발견). charset은 문서 첫 1024바이트
  // 안에 있어야 하므로 CSP를 그보다 앞에 두면 안 된다 - 바로 뒤가 가장 이른 위치다.
  const CHARSET_TAG = '<meta charset="UTF-8" />';
  const metaTag = `${CHARSET_TAG}\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`;
  const updatedHtml = html.replace(CHARSET_TAG, metaTag);

  if (updatedHtml === html) {
    throw new Error(
      'index.html에서 <meta charset="UTF-8" />를 찾지 못해 CSP meta 태그를 주입하지 못했다.'
    );
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
