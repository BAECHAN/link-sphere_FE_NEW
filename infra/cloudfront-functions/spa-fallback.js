// SPA 클라이언트 라우팅 폴백. CloudFront 배포(E1ZZPXFS3GSVZ6)의
// **기본(S3) 비헤이비어 viewer-request에만** 연결한다 — 절대 /api/* 비헤이비어에는 연결하지 않는다.
// 정적 파일(마지막 경로 세그먼트에 확장자가 있는 요청)은 그대로 통과시키고,
// 앱 라우트(예: /post/abc123, /auth/login)는 /index.html로, 앱 라우트가 아닌 경로
// (예: /oops, /.git/config)는 /404.html(배포 때 index.html을 복사해 올린 사본)로 리라이트한다.
// /404.html 응답은 viewer-response 함수(spa-status.js)가 상태만 404로 바꾼다 - 화면은
// 같은 앱이 그려 React Router의 * 라우트(NotFoundPage)가 뜬다. SPA가 없는 경로에 200을
// 주면 검색엔진이 soft 404로 본다(https://developers.google.com/search/docs/crawling-indexing/http-network-errors).
//
// 배포 전에는 distribution 레벨 CustomErrorResponses(403/404 → index.html)로 이 역할을 하고
// 있었는데, 그 설정은 오리진 구분 없이 전체 배포에 걸려 /api/* 오리진(Lambda)의 정상 403/404
// 응답까지 index.html(200)로 가려버리는 버그가 있었다. 이 Function이 비헤이비어 단위로 그 역할을
// 대체하므로 CustomErrorResponses의 403/404 항목은 함께 제거했다.
//
// 정적 파일 중 /assets/의 .js·.css는 br을 받는 요청에 한해 주소 끝에 .br을 붙인다. 배포가 brotli
// 최고 단계로 미리 눌러 원본 옆에 올린 사본이다(scripts/precompress-assets.js, deploy.yml "Upload to S3").
// br을 받지 않는 요청은 주소를 그대로 두어 원본을 CloudFront가 실시간 압축한다. 이 Function은 파일이
// 있는지 모른다 - .br 짝 없이 배포된 빌드는 br 브라우저에서 403이 되므로, 이 분기를 켠 뒤에는 짝을
// 올리지 않는 커밋을 배포하지 않는다(되돌릴 땐 Function 먼저, docs/DEPLOY.md "사전 brotli 압축").
//
// APP_ROUTES는 src/app/routes/AppRoutes.tsx의 appRoutes를 손으로 옮긴 것이다(Function은 앱 코드를
// import할 수 없다). 라우트를 추가하면 여기도 고치고 Function을 다시 배포한다 - 빠뜨리면
// src/app/routes/cloudfront-functions.test.ts가 실패한다.
//
// 배포는 GitHub Actions 파이프라인 대상이 아니다 — AWS CLI로 수동 배포된다.
// 절차: docs/DEPLOY.md의 "CloudFront Function (수동 관리)" 참고.
var APP_ROUTES = {
  '/': true,
  '/post': true,
  '/post/submit': true,
  '/auth/login': true,
  '/auth/sign-up': true,
  '/auth/forgot-password': true,
  '/auth/reset-password': true,
  '/auth/verify-email': true,
  '/bookmark': true,
  '/my/comments': true,
  '/my/account': true,
  '/version': true,
  '/403': true,
  '/500': true,
};

// 동적 세그먼트가 있는 라우트(/post/:id, /post/edit/:id)
var APP_ROUTE_PATTERNS = [/^\/post\/[^/]+$/, /^\/post\/edit\/[^/]+$/];

function isAppRoute(uri) {
  // React Router는 끝 슬래시를 무시하므로(/post/ == /post) 같은 기준으로 비교한다
  var path = uri.length > 1 ? uri.replace(/\/+$/, '') : uri;

  if (path === '') {
    path = '/';
  }

  if (APP_ROUTES[path]) {
    return true;
  }

  for (var i = 0; i < APP_ROUTE_PATTERNS.length; i++) {
    if (APP_ROUTE_PATTERNS[i].test(path)) {
      return true;
    }
  }

  return false;
}

// 사전 압축 사본(.br)이 함께 올라가는 범위 - scripts/lib/precompress-assets.js의 isPrecompressTarget과 같아야 한다
var PRECOMPRESSED_ASSET = /^\/assets\/.+\.(js|css)$/;

function acceptsBrotli(request) {
  var header = request.headers['accept-encoding'];

  if (!header) {
    return false;
  }

  var codings = header.value.toLowerCase().split(',');

  for (var i = 0; i < codings.length; i++) {
    var parts = codings[i].split(';');

    if (parts[0].trim() !== 'br') {
      continue;
    }

    // q=0은 그 방식을 받지 않겠다는 뜻이다(RFC 9110 12.5.3, https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.3)
    return !/^\s*q=0(\.0{0,3})?\s*$/.test(parts[1] || '');
  }

  return false;
}

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  var hasExtension = lastSegment.indexOf('.') !== -1;

  if (hasExtension) {
    if (PRECOMPRESSED_ASSET.test(uri) && acceptsBrotli(request)) {
      request.uri = uri + '.br';
    }

    return request;
  }

  request.uri = isAppRoute(uri) ? '/index.html' : '/404.html';

  return request;
}
