import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { appRoutes } from '@/app/routes';

/**
 * infra/cloudfront-functions/*.js는 CloudFront 런타임용 평문 JS라 export가 없다.
 * 파일 내용을 읽어 handler를 꺼내 실행한다.
 */
type CloudFrontHandler = (event: unknown) => {
  uri?: string;
  statusCode?: number;
  headers?: Record<string, { value: string }>;
};

function loadHandler(fileName: string): CloudFrontHandler {
  const code = readFileSync(
    path.resolve(__dirname, '../../../infra/cloudfront-functions', fileName),
    'utf8'
  );

  const createHandler = new Function(`${code}\nreturn handler;`) as () => CloudFrontHandler;

  return createHandler();
}

const spaFallback = loadHandler('spa-fallback.js');
const spaStatus = loadHandler('spa-status.js');

function rewrite(uri: string): string | undefined {
  return spaFallback({ request: { uri } }).uri;
}

/** appRoutes를 돌며 절대 경로를 모은다. `*`(404)는 제외, 동적 세그먼트는 샘플 값으로 채운다. */
function collectAppPaths(routes: RouteObject[]): string[] {
  return routes.flatMap((route) => {
    const own =
      route.path && route.path !== '*' ? [route.path.replace(/:[^/]+/g, 'sample-id')] : [];

    return [...own, ...collectAppPaths(route.children ?? [])];
  });
}

describe('spa-fallback.js (viewer-request)', () => {
  const appPaths = collectAppPaths(appRoutes);

  it('앱 라우트를 하나 이상 찾았다(수집 로직 자체 확인)', () => {
    expect(appPaths).toContain('/post/sample-id');
    expect(appPaths.length).toBeGreaterThan(10);
  });

  it.each(appPaths)(
    '앱 라우트 %s → /index.html (Function의 APP_ROUTES에 빠진 라우트가 없어야 한다)',
    (uri) => {
      expect(rewrite(uri)).toBe('/index.html');
    }
  );

  it.each(['/post/', '/auth/login/', '/'])('끝 슬래시가 있어도 앱 라우트로 본다: %s', (uri) => {
    expect(rewrite(uri)).toBe('/index.html');
  });

  it.each([
    '/oops',
    '/.git/config',
    '/.git/HEAD',
    '/wp-admin',
    '/post/abc/extra',
    '/my',
    '/storybook',
    '/storybook/',
  ])('앱 라우트가 아닌 %s → /404.html', (uri) => {
    expect(rewrite(uri)).toBe('/404.html');
  });

  it.each([
    ['/favicon.ico', '/favicon.ico'],
    ['/assets/js/index-abc.js', '/assets/js/index-abc.js'],
  ])('정적 파일은 그대로 통과: %s → %s', (uri, expected) => {
    expect(rewrite(uri)).toBe(expected);
  });
});

describe('spa-status.js (viewer-response)', () => {
  function respond(uri: string) {
    const response = { statusCode: 200, statusDescription: 'OK', headers: {} };

    return spaStatus({ request: { uri }, response });
  }

  it('/404.html 응답은 상태를 404로 바꾼다', () => {
    expect(respond('/404.html').statusCode).toBe(404);
  });

  it('/index.html 응답의 상태는 그대로 둔다', () => {
    expect(respond('/index.html').statusCode).toBe(200);
  });

  it.each(['/index.html', '/404.html'])(
    '앱 HTML %s에는 외부 이미지 요청에서 쿠키를 빼도록 COEP credentialless를 붙인다',
    (uri) => {
      expect(respond(uri).headers?.['cross-origin-embedder-policy']).toEqual({
        value: 'credentialless',
      });
    }
  );

  it.each(['/assets/js/index-abc.js', '/firebase-messaging-sw.js', '/storybook/index.html'])(
    'HTML이 아니거나 앱 밖인 %s는 건드리지 않는다',
    (uri) => {
      const result = respond(uri);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({});
    }
  );
});
