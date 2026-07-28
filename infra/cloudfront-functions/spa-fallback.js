// SPA 클라이언트 라우팅 폴백. CloudFront 배포(E1ZZPXFS3GSVZ6)의
// **기본(S3) 비헤이비어 viewer-request에만** 연결한다 — 절대 /api/* 비헤이비어에는 연결하지 않는다.
// 정적 파일(마지막 경로 세그먼트에 확장자가 있는 요청)은 그대로 통과시키고,
// 그 외(=클라이언트 라우트, 예: /post/abc123, /auth/login)는 /index.html로 리라이트한다.
//
// 배포 전에는 distribution 레벨 CustomErrorResponses(403/404 → index.html)로 이 역할을 하고
// 있었는데, 그 설정은 오리진 구분 없이 전체 배포에 걸려 /api/* 오리진(Lambda)의 정상 403/404
// 응답까지 index.html(200)로 가려버리는 버그가 있었다. 이 Function이 비헤이비어 단위로 그 역할을
// 대체하므로 CustomErrorResponses의 403/404 항목은 함께 제거했다.
//
// 배포는 GitHub Actions 파이프라인 대상이 아니다 — AWS CLI로 수동 배포된다.
// 절차: docs/DEPLOY.md의 "CloudFront Function (수동 관리)" 참고.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  var hasExtension = lastSegment.indexOf('.') !== -1;

  if (!hasExtension) {
    request.uri = '/index.html';
  }

  return request;
}
