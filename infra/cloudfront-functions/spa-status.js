// SPA의 없는 경로에 진짜 404 상태를 주고, 앱 HTML 응답에 COEP 헤더를 붙인다. CloudFront 배포(E1ZZPXFS3GSVZ6)의
// **기본(S3) 비헤이비어 viewer-response에만** 연결한다 — /api/* 비헤이비어에는 연결하지 않는다.
//
// viewer-request 함수(spa-fallback.js)가 앱 라우트가 아닌 경로를 /404.html(index.html 사본)로
// 리라이트하면, 여기서 그 응답의 상태만 404로 바꾼다. body를 지정하지 않으면 원래 본문이 그대로
// 간다 - 그래서 화면은 앱이 그대로 그리고(React Router의 * 라우트), 상태만 404가 된다
// (https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html
// "Status code and body"). 오리진이 400 이상을 주면 이 함수는 아예 실행되지 않는다(같은 문서) -
// 없는 정적 파일의 S3 403은 여기서 바꿀 수 없다.
//
// 앱 HTML(/index.html, /404.html)에는 Cross-Origin-Embedder-Policy: credentialless를 붙인다. 피드·상세의
// og 썸네일은 외부 사이트 이미지를 <img>로 바로 불러오는데(no-cors), 그러면 브라우저가 사용자 쿠키 저장소에
// 있던 그 사이트 쿠키를 함께 보낸다 - Lighthouse Best Practices가 third-party-cookies로 77점까지 떨어진
// 원인이었다(2026-10-26, docs/PERFORMANCE.md "Best Practices 77점 사례"). credentialless는 no-cors 교차 출처
// 요청에서 쿠키를 빼고 응답 쿠키도 무시한다(https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy).
// 문서 응답에만 의미가 있는 헤더라 정적 파일(서비스 워커 스크립트 포함)·/storybook에는 붙이지 않는다.
//
// 사전 압축 사본(/assets/의 .js.br·.css.br, spa-fallback.js가 br을 받는 요청을 여기로 보낸다) 응답에는
// Vary: Accept-Encoding을 붙인다. 브라우저가 보는 주소는 .br이 없는 원래 주소라, 이 헤더가 없으면 중간 캐시가
// br 본문을 br을 못 받는 클라이언트에 줄 수 있다. CloudFront는 자신이 압축한 응답에만 이 헤더를 붙이고 S3에서
// 이미 눌린 채 온 응답에는 붙이지 않았다(2026-11-16 직접 관찰, docs/PERFORMANCE.md "사전 brotli 압축").
//
// 배포는 GitHub Actions 파이프라인 대상이 아니다 — AWS CLI로 수동 배포된다.
// 절차: docs/DEPLOY.md의 "CloudFront Function (수동 관리)" 참고.
var PRECOMPRESSED_COPY = /^\/assets\/.+\.(js|css)\.br$/;

function handler(event) {
  var response = event.response;
  var uri = event.request.uri;

  if (uri === '/404.html') {
    response.statusCode = 404;
    response.statusDescription = 'Not Found';
  }

  if (uri === '/index.html' || uri === '/404.html') {
    response.headers['cross-origin-embedder-policy'] = { value: 'credentialless' };
  }

  if (PRECOMPRESSED_COPY.test(uri)) {
    var vary = response.headers['vary'];

    // 오리진이 이미 Vary를 줬으면(S3 CORS의 Origin 등) 지우지 않고 덧붙인다
    response.headers['vary'] = {
      value: vary ? vary.value + ', Accept-Encoding' : 'Accept-Encoding',
    };
  }

  return response;
}
