import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { appRoutes } from '@/app/routes/AppRoutes';
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import {
  TEST_CASES_PATH,
  buildTestEvent,
  findMismatches,
  type FunctionTestSuite,
} from '../../../scripts/lib/cloudfront-function-deploy.js';

/**
 * infra/cloudfront-functions/*.js는 CloudFront 런타임용 평문 JS라 export가 없다.
 * 파일 내용을 읽어 handler를 꺼내 실행한다.
 */
type CloudFrontHandler = (event: unknown) => {
  uri?: string;
  statusCode?: number;
  headers?: Record<string, { value: string }>;
};

/** 런타임 2.0의 `cloudfront` 모듈 대역. 고른 오리진 id를 모은다 */
interface FakeCloudFrontModule {
  selectedOrigins: string[];
  selectRequestOriginById: (originId: string) => void;
}

function createFakeCloudFrontModule(): FakeCloudFrontModule {
  const fake: FakeCloudFrontModule = {
    selectedOrigins: [],
    selectRequestOriginById: (originId) => {
      fake.selectedOrigins.push(originId);
    },
  };

  return fake;
}

// 런타임 2.0 Function의 첫 줄. new Function 안에서는 import를 쓸 수 없어 이 줄을 빼고 대역을 인자로 넣는다
const CLOUDFRONT_IMPORT = "import cf from 'cloudfront';";

function loadHandler(
  fileName: string,
  cloudfront: FakeCloudFrontModule = createFakeCloudFrontModule()
): CloudFrontHandler {
  const code = readFileSync(
    path.resolve(__dirname, '../../../infra/cloudfront-functions', fileName),
    'utf8'
  );

  const createHandler = new Function(
    'cf',
    `${code.replace(CLOUDFRONT_IMPORT, '')}\nreturn handler;`
  ) as (cf: FakeCloudFrontModule) => CloudFrontHandler;

  return createHandler(cloudfront);
}

const cloudfront = createFakeCloudFrontModule();
const spaFallback = loadHandler('spa-fallback.js', cloudfront);
const spaStatus = loadHandler('spa-status.js');

/** acceptEncoding을 주지 않으면 Accept-Encoding 헤더가 없는 요청이다 */
function rewrite(uri: string, acceptEncoding?: string): string | undefined {
  const headers =
    acceptEncoding === undefined ? {} : { 'accept-encoding': { value: acceptEncoding } };

  return spaFallback({ request: { method: 'GET', uri, headers } }).uri;
}

/** 미리보기 봇 분기를 보려고 UA·메서드를 넣어 요청하고, 바뀐 주소와 고른 오리진을 함께 돌려준다 */
function rewriteAs(userAgent: string, uri: string, method = 'GET') {
  cloudfront.selectedOrigins.length = 0;

  const result = spaFallback({
    request: { method, uri, headers: { 'user-agent': { value: userAgent } } },
  });

  return { uri: result.uri, origins: [...cloudfront.selectedOrigins] };
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

  it.each([
    ['/assets/js/index-abc.js', 'gzip, deflate, br, zstd'],
    ['/assets/css/index-abc.css', 'br'],
    ['/assets/js/index-abc.js', 'gzip, BR;q=0.9'],
  ])('br을 받는 요청의 /assets/ .js·.css는 사전 압축 사본으로: %s (%s)', (uri, acceptEncoding) => {
    expect(rewrite(uri, acceptEncoding)).toBe(`${uri}.br`);
  });

  it.each([
    ['/assets/js/index-abc.js', undefined],
    ['/assets/js/index-abc.js', 'gzip, deflate'],
    ['/assets/js/index-abc.js', 'br;q=0, gzip'],
    ['/assets/js/index-abc.js', 'br;q=0.0, gzip'],
    ['/assets/js/index-abc.js', 'brotli'],
    ['/assets/js/index-abc.js.br', 'gzip, deflate, br, zstd'],
    ['/assets/img/logo-abc.svg', 'gzip, deflate, br, zstd'],
    ['/fonts/pretendard-1.3.9/a.woff2', 'gzip, deflate, br, zstd'],
    ['/firebase-messaging-sw.js', 'gzip, deflate, br, zstd'],
  ])(
    'br을 받지 않거나 사전 압축 범위 밖이면 주소를 그대로 둔다: %s (%s)',
    (uri, acceptEncoding) => {
      expect(rewrite(uri, acceptEncoding)).toBe(uri);
    }
  );

  it('앱 라우트는 br을 받는 요청이어도 /index.html로 간다', () => {
    expect(rewrite('/post/abc123', 'gzip, deflate, br, zstd')).toBe('/index.html');
  });
});

// 각 서비스의 링크 미리보기 봇이 보내는 User-Agent(출처는 spa-fallback.js의 PREVIEW_BOT 주석)
const PREVIEW_BOT_USER_AGENTS = [
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984',
  'Twitterbot/1.0',
  'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  'TelegramBot (like TwitterBot)',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  'WhatsApp/2.22.20.72 A',
] as const;

describe('spa-fallback.js 미리보기 봇 분기', () => {
  const POST_ID = '805a8e89-ca5b-4800-a50d-fff5c233017f';

  it.each(PREVIEW_BOT_USER_AGENTS)(
    '미리보기 봇(%s)의 글 주소는 BE 오리진의 OG HTML로 보낸다',
    (userAgent) => {
      expect(rewriteAs(userAgent, `/post/${POST_ID}`)).toEqual({
        uri: `/api/og/post/${POST_ID}`,
        origins: ['link-sphere-be'],
      });
    }
  );

  it('글 주소 끝에 /가 있어도 BE 주소에는 붙이지 않는다', () => {
    expect(rewriteAs(PREVIEW_BOT_USER_AGENTS[0], `/post/${POST_ID}/`)).toEqual({
      uri: `/api/og/post/${POST_ID}`,
      origins: ['link-sphere-be'],
    });
  });

  it.each([
    [
      '일반 브라우저',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ],
    ['검색 봇', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ])('%s의 글 주소는 지금처럼 앱 HTML로 간다', (_, userAgent) => {
    expect(rewriteAs(userAgent, `/post/${POST_ID}`)).toEqual({ uri: '/index.html', origins: [] });
  });

  it('미리보기 봇이라도 HEAD 요청은 앱 HTML로 둔다(BE 경로는 GET만 연다)', () => {
    expect(rewriteAs(PREVIEW_BOT_USER_AGENTS[0], `/post/${POST_ID}`, 'HEAD')).toEqual({
      uri: '/index.html',
      origins: [],
    });
  });

  it.each([
    ['/post/submit', '/index.html'],
    [`/post/edit/${POST_ID}`, '/index.html'],
    ['/post/abc123', '/index.html'],
    ['/', '/index.html'],
    ['/oops', '/404.html'],
    ['/assets/js/index-abc.js', '/assets/js/index-abc.js'],
  ])('미리보기 봇이라도 글 상세(UUID)가 아닌 %s는 지금 그대로 %s', (uri, expected) => {
    expect(rewriteAs(PREVIEW_BOT_USER_AGENTS[0], uri)).toEqual({ uri: expected, origins: [] });
  });
});

describe('spa-status.js (viewer-response)', () => {
  function respond(uri: string, headers: Record<string, { value: string }> = {}) {
    const response = { statusCode: 200, statusDescription: 'OK', headers };

    return spaStatus({ request: { uri }, response });
  }

  it.each(['/assets/js/index-abc.js.br', '/assets/css/index-abc.css.br'])(
    '사전 압축 사본 %s 응답에는 Vary: Accept-Encoding을 붙인다',
    (uri) => {
      expect(respond(uri).headers).toEqual({ vary: { value: 'Accept-Encoding' } });
    }
  );

  it('오리진이 준 Vary가 있으면 지우지 않고 덧붙인다', () => {
    expect(respond('/assets/js/index-abc.js.br', { vary: { value: 'Origin' } }).headers).toEqual({
      vary: { value: 'Origin, Accept-Encoding' },
    });
  });

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

// 배포 때 `aws cloudfront test-function`이 실제 런타임에서 돌리는 케이스다(scripts/deploy-cloudfront-functions.js).
// 같은 파일을 여기서도 돌려, 케이스가 틀려서 배포가 멈추는 일을 PR 단계에서 잡는다.
describe('test-cases.json (배포 전 test-function 케이스)', () => {
  const suites = JSON.parse(
    readFileSync(path.resolve(__dirname, '../../..', TEST_CASES_PATH), 'utf8')
  ) as FunctionTestSuite[];

  it('Function 파일마다 케이스가 있다', () => {
    expect(suites.map(({ file }) => file).sort()).toEqual(['spa-fallback.js', 'spa-status.js']);

    for (const { cases } of suites) {
      expect(cases.length).toBeGreaterThan(0);
    }
  });

  describe.each(suites)('$file', ({ file, eventType, cases }) => {
    const handler = loadHandler(file);

    it.each(cases)(
      '$uri (accept-encoding: $acceptEncoding, user-agent: $userAgent)',
      (testCase) => {
        expect(findMismatches(testCase, handler(buildTestEvent(eventType, testCase)))).toEqual([]);
      }
    );
  });
});
