import cf from 'cloudfront';
// 위 줄은 런타임 cloudfront-js-2.0에서 오리진을 바꾸는 cf.selectRequestOriginById를 쓰려면 코드 첫 줄에 있어야 한다
// (https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/helper-functions-origin-modification.html).
// 그래서 이 Function은 2.0이다(2026-11-20 CloudShell에서 전환, 런타임은 배포 대상이 아니다 - docs/DEPLOY.md
// "CloudFront Function"). 1.0으로 되돌리면 이 줄에서 실패한다.
//
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
// import할 수 없다). 라우트를 추가하면 여기도 고친다 - 빠뜨리면
// src/app/routes/cloudfront-functions.test.ts가 실패한다.
//
// 메신저 링크 미리보기 봇이 글 상세(/post/<UUID>)를 GET하면 오리진을 BE(Lambda)로 바꾸고 주소를
// /api/og/post/<UUID>로 바꾼다. BE가 그 글의 제목·설명·썸네일을 담은 OG 태그 HTML을 준다(BE PostOgController).
// 사람과 검색 봇은 지금처럼 /index.html을 받는다 - 검색 봇에 OG만 든 HTML을 주면 앱 본문이 색인되지 않는다.
// 캐시 키는 바뀐 주소로 잡혀 사람의 /index.html과 섞이지 않는다(FE docs/plans/2026-11-19-post-link-in-app-and-og.md).
// HEAD는 보내지 않는다 - BE는 이 경로의 GET만 연다.
//
// 이 파일을 고친 PR이 병합되면 deploy.yml이 test-cases.json의 케이스를 실제 런타임에서 돌린 뒤 게시한다
// (scripts/deploy-cloudfront-functions.js, docs/DEPLOY.md "CloudFront Function"). test-function은 오리진이 바뀌었는지는
// 보지 않고 코드가 오류 없이 도는지만 본다(위 AWS 문서) - 오리진 선택은 cloudfront-functions.test.ts와 배포 뒤 curl로 확인한다.
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

// 링크 미리보기 봇의 User-Agent 토큰(대소문자 무시). 근거(2026-11-20 확인):
// - 공식 문서: Slackbot-LinkExpanding(https://api.slack.com/robots - 같은 문서의 Slack-ImgProxy는 이미지만 받아 넣지 않는다),
//   facebookexternalhit(https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/ - AI 크롤러 meta-external*는 넣지 않는다),
//   Discordbot(https://docs.discord.com/developers/link-previews/component-embeds),
//   WhatsApp/(https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/)
// - X 문서의 문장을 재인용: Twitterbot
// - 공식 문서를 못 찾아 2차 출처: kakaotalk-scrap(https://devtalk.kakao.com/t/scrap/33984),
//   TelegramBot(https://bugs.telegram.org/c/61650/18), LinkedInBot(https://radar.cloudflare.com/bots/directory/linkedin)
// 목록에 없는 서비스는 지금처럼 사이트 기본 미리보기가 나온다
var PREVIEW_BOT =
  /slackbot-linkexpanding|facebookexternalhit|discordbot|whatsapp\/|twitterbot|kakaotalk-scrap|telegrambot|linkedinbot/i;

// 글 상세 주소. 끝 /는 허용하고, BE 주소에는 붙이지 않는다(BE 매처가 /og/post/*라 끝 /가 있으면 맞지 않는다)
var POST_DETAIL =
  /^\/post\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\/?$/;

// 배포의 BE 오리진 Id(infra/cloudfront/snapshot.json의 Origins)
var BE_ORIGIN_ID = 'link-sphere-be';

/** 미리보기 봇이 글 상세를 GET한 요청이면 그 글 id, 아니면 null */
function previewBotPostId(request) {
  if (request.method !== 'GET') {
    return null;
  }

  var userAgent = request.headers['user-agent'];

  if (!userAgent || !PREVIEW_BOT.test(userAgent.value)) {
    return null;
  }

  var match = POST_DETAIL.exec(request.uri);

  return match ? match[1] : null;
}

function handler(event) {
  var request = event.request;
  var botPostId = previewBotPostId(request);

  if (botPostId) {
    cf.selectRequestOriginById(BE_ORIGIN_ID);
    request.uri = '/api/og/post/' + botPostId;

    return request;
  }

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
