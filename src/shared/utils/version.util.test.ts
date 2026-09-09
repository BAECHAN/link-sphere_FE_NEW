import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { VersionUtil } from '@/shared/utils/version.util';

// vite build가 실제로 만드는 <head> 형태를 그대로 픽스처로 쓴다(dist/index.html에서 확인).
// crossorigin이 src보다 앞에 오는 속성 순서까지 그대로 재현한다.
const DEPLOYED_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>Link Sphere</title>
    <link rel="icon" href="/favicons/favicon.ico" sizes="any" />
    <script type="module" crossorigin src="/assets/js/index-C3S2pCZt.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/js/react-vendor-4oBVDOjb.js">
    <link rel="stylesheet" crossorigin href="/assets/index-BAial7yH.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const DEV_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <script type="module" src="/src/main.tsx"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('VersionUtil.readEntryScriptSrc', () => {
  it('prod 빌드 형태(script가 modulepreload link보다 먼저)에서 진입 스크립트 src를 읽는다', () => {
    expect(VersionUtil.readEntryScriptSrc(parse(DEPLOYED_HTML))).toBe(
      '/assets/js/index-C3S2pCZt.js'
    );
  });

  it('dev 형태(/src/main.tsx)도 그대로 반환한다 - 판단은 호출부 몫', () => {
    expect(VersionUtil.readEntryScriptSrc(parse(DEV_HTML))).toBe('/src/main.tsx');
  });

  it('script 태그가 없으면 null이다', () => {
    const html = '<html><head><link rel="icon" href="/favicon.ico" /></head><body></body></html>';
    expect(VersionUtil.readEntryScriptSrc(parse(html))).toBeNull();
  });

  it('type="module"이 아닌 script만 있으면 null이다', () => {
    const html = '<html><head><script src="/legacy.js"></script></head><body></body></html>';
    expect(VersionUtil.readEntryScriptSrc(parse(html))).toBeNull();
  });
});

describe('VersionUtil.fetchDeployedEntryScriptSrc', () => {
  it('200 응답이면 진입 스크립트 src를 반환한다', async () => {
    server.use(
      http.get(
        '*/index.html',
        () => new HttpResponse(DEPLOYED_HTML, { headers: { 'Content-Type': 'text/html' } })
      )
    );

    await expect(VersionUtil.fetchDeployedEntryScriptSrc()).resolves.toBe(
      '/assets/js/index-C3S2pCZt.js'
    );
  });

  it('비정상 응답(5xx)이면 null이다', async () => {
    server.use(http.get('*/index.html', () => new HttpResponse(null, { status: 500 })));

    await expect(VersionUtil.fetchDeployedEntryScriptSrc()).resolves.toBeNull();
  });

  it('네트워크 에러면 null이다', async () => {
    server.use(http.get('*/index.html', () => HttpResponse.error()));

    await expect(VersionUtil.fetchDeployedEntryScriptSrc()).resolves.toBeNull();
  });

  it('200이지만 진입 스크립트를 못 찾으면 null이다', async () => {
    server.use(
      http.get(
        '*/index.html',
        () =>
          new HttpResponse('<html><head></head><body></body></html>', {
            headers: { 'Content-Type': 'text/html' },
          })
      )
    );

    await expect(VersionUtil.fetchDeployedEntryScriptSrc()).resolves.toBeNull();
  });
});
