// SPA의 없는 경로에 진짜 404 상태를 준다. CloudFront 배포(E1ZZPXFS3GSVZ6)의
// **기본(S3) 비헤이비어 viewer-response에만** 연결한다 — /api/* 비헤이비어에는 연결하지 않는다.
//
// viewer-request 함수(spa-fallback.js)가 앱 라우트가 아닌 경로를 /404.html(index.html 사본)로
// 리라이트하면, 여기서 그 응답의 상태만 404로 바꾼다. body를 지정하지 않으면 원래 본문이 그대로
// 간다 - 그래서 화면은 앱이 그대로 그리고(React Router의 * 라우트), 상태만 404가 된다
// (https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html
// "Status code and body"). 오리진이 400 이상을 주면 이 함수는 아예 실행되지 않는다(같은 문서) -
// 없는 정적 파일의 S3 403은 여기서 바꿀 수 없다.
//
// 배포는 GitHub Actions 파이프라인 대상이 아니다 — AWS CLI로 수동 배포된다.
// 절차: docs/DEPLOY.md의 "CloudFront Function (수동 관리)" 참고.
function handler(event) {
  var response = event.response;

  if (event.request.uri === '/404.html') {
    response.statusCode = 404;
    response.statusDescription = 'Not Found';
  }

  return response;
}
