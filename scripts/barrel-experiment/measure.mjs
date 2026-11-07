// 배럴 비용 비교 실험의 측정기(docs/plans/2026-11-07-barrel-measurement.md). A(현재)·B(슬라이스 배럴)·
// C(shared까지 통합 배럴) 워크트리를 라운드마다 순서를 돌려 가며 재고, 한 줄에 한 결과씩 JSONL로 쌓는다.
// 운영 API를 때리지 않도록 /api는 전부 모킹하고 localhost 밖 요청은 막는다.
//
//   node scripts/barrel-experiment/measure.mjs --suite dev   --rounds 10 --out <파일> --exp <워크트리 부모>
//   node scripts/barrel-experiment/measure.mjs --suite tool  --rounds 5  --out <파일> --exp <워크트리 부모>
//   node scripts/barrel-experiment/measure.mjs --suite lcp   --rounds 10 --out <파일> --exp <워크트리 부모>
//   node scripts/barrel-experiment/measure.mjs --suite bundle            --out <파일> --exp <워크트리 부모>

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';

const VARIANTS = ['a', 'b', 'c'];
const PORTS = { a: 31901, b: 31902, c: 31903 };
const PAGE_TIMEOUT_MS = 60_000;
const HMR_TIMEOUT_MS = 30_000;
const HMR_QUIET_MS = 1_500;
const HMR_TARGETS = {
  component: 'src/widgets/post/post-card/ui/PostCard.tsx',
  queryKeys: 'src/entities/post/api/post.keys.ts',
  texts: 'src/shared/config/texts.ts',
};
// 배포와 같게 CI=true로 돌려 로컬 전용 번들 분석 리포트를 빼고, 운영처럼 같은 출처의 /api를 부르게 한다
const BUILD_ENV = { CI: 'true', VITE_API_BASE_URL: '/api' };
const POST_TITLE = 'Barrel Measure Post 1';
const COMMENT_TEXT = 'Barrel measure comment';

function parseArgs(argv) {
  const args = { rounds: 1 };

  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }

  args.rounds = Number(args.rounds);

  if (!args.suite || !args.out || !args.exp) {
    throw new Error('--suite, --out, --exp 가 필요하다');
  }

  return args;
}

const stripAnsi = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 라운드마다 시작 순서를 돌려 예열·발열 편향을 줄인다 */
function rotatedVariants(round) {
  const offset = round % VARIANTS.length;

  return [...VARIANTS.slice(offset), ...VARIANTS.slice(0, offset)];
}

function makePost(index) {
  return {
    id: `post-uuid-${index}`,
    url: `https://example.com/article-${index}`,
    title: `Barrel Measure Post ${index}`,
    description: 'A post used to measure the first load of the feed',
    tags: ['react', 'testing'],
    categories: [{ id: 1, name: 'Frontend' }],
    ogImage: null,
    aiSummary: null,
    aiStatus: 'NONE',
    stats: { viewCount: 0, likeCount: 0, commentCount: 1, bookmarkCount: 0 },
    userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
    createdAt: '2025-01-01T00:00:00.000Z',
    isPrivate: false,
    isSemanticMatch: false,
    author: { id: 'user-uuid-1', nickname: 'testuser' },
  };
}

const POSTS = Array.from({ length: 12 }, (_, index) => makePost(index + 1));
const COMMENT = {
  id: 'comment-uuid-1',
  content: COMMENT_TEXT,
  isDeleted: false,
  createdAt: '2025-01-01T00:00:00.000Z',
  author: { id: 'user-uuid-1', nickname: 'testuser', image: null },
  likeCount: 0,
  isLiked: false,
  replies: [],
};

const envelope = (data) => ({
  status: 200,
  message: 'ok',
  data,
  timestamp: '2025-01-01T00:00:00.000Z',
});

/** 앱이 부르는 API만 응답하고 나머지는 e2e catch-all처럼 끊는다(비로그인 상태) */
async function installMocks(context, tracker) {
  await context.route(
    () => true,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.hostname !== 'localhost') {
        tracker.externalBlocked += 1;
        await route.abort();

        return;
      }

      if (!url.pathname.startsWith('/api/')) {
        await route.fallback();

        return;
      }

      if (url.pathname === '/api/post') {
        await route.fulfill({ json: envelope({ content: POSTS, nextCursor: null }) });
      } else if (url.pathname === '/api/common/category-option') {
        await route.fulfill({ json: envelope(POSTS[0].categories) });
      } else if (/^\/api\/post\/[^/]+\/comment$/.test(url.pathname)) {
        await route.fulfill({ json: envelope([COMMENT]) });
      } else if (/^\/api\/post\/[^/]+\/view$/.test(url.pathname)) {
        await route.fulfill({ json: envelope(null) });
      } else if (/^\/api\/post\/[^/]+$/.test(url.pathname)) {
        await route.fulfill({ json: envelope(POSTS[0]) });
      } else {
        tracker.unmockedApi.add(`${request.method()} ${url.pathname}`);
        await route.abort();
      }
    }
  );
}

function binIn(root, name) {
  return path.join(root, 'node_modules/.bin', name);
}

/** 명령을 끝까지 돌려 벽시계 시간과 출력을 돌려준다 */
function timed(root, command, args, env = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env } });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('close', (code) => {
      resolve({ ms: performance.now() - start, code, output: stripAnsi(output) });
    });
  });
}

/** vite 서버를 띄우고 ready 줄을 기다린다 */
function startServer(root, args) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const child = spawn(binIn(root, 'vite'), args, { cwd: root, env: process.env });
    let output = '';

    // 측정기가 오류로 끝나도 서버를 남기지 않는다(남으면 다음 실행의 --strictPort가 실패한다)
    process.once('exit', () => child.kill('SIGKILL'));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`서버 시작 시간 초과: ${stripAnsi(output).slice(-400)}`));
    }, PAGE_TIMEOUT_MS);

    const onData = (chunk) => {
      output += chunk;

      const text = stripAnsi(output);
      const ready = text.match(/ready in (\d+) ms/);

      if (ready || /Local:\s+http/.test(text)) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolve({
          child,
          viteReadyMs: ready ? Number(ready[1]) : null,
          wallReadyMs: performance.now() - start,
        });
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`서버가 일찍 끝남(${code}): ${stripAnsi(output).slice(-400)}`));
    });
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    child.removeAllListeners('exit');
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 3_000).unref();
  });
}

function makeTracker() {
  return { externalBlocked: 0, unmockedApi: new Set() };
}

/** 새 컨텍스트(캐시 없음)로 화면을 열어 load와 내용 표시까지의 시간, 받은 모듈 수를 잰다 */
async function measurePage(browser, baseUrl, pathname, contentText, contextOptions = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', ...contextOptions });
  const tracker = makeTracker();

  await installMocks(context, tracker);

  const page = await context.newPage();
  const pageErrors = [];
  const sourceModules = new Set();
  let scriptRequests = 0;

  page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));
  page.on('request', (request) => {
    const url = new URL(request.url());

    if (url.pathname.startsWith('/src/')) {
      sourceModules.add(url.pathname);
    }

    if (request.resourceType() === 'script') {
      scriptRequests += 1;
    }
  });

  const start = performance.now();
  let loadMs = null;
  let contentMs = null;
  let failure = null;

  try {
    await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS });
    loadMs = performance.now() - start;
    await page
      .getByText(contentText, { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
    contentMs = performance.now() - start;
    // 내용이 뜬 뒤에도 lazy 청크가 이어지므로 잠시 지켜본 뒤 센다
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  } catch (error) {
    failure = error.message.split('\n')[0].slice(0, 200);
  }

  const result = {
    loadMs,
    contentMs,
    sourceModules: sourceModules.size,
    scriptRequests,
    barrelRequested: sourceModules.has('/src/entities/post/index.ts'),
    externalBlocked: tracker.externalBlocked,
    unmockedApi: [...tracker.unmockedApi].sort(),
    pageErrors,
    failure,
  };

  await context.close();

  return result;
}

/** 파일 끝에 주석을 덧붙여 저장하고 HMR이 잠잠해질 때까지의 시간과 갱신 수를 잰다 */
async function measureHmr(browser, baseUrl, root, target) {
  const context = await browser.newContext({ serviceWorkers: 'block' });

  await installMocks(context, makeTracker());

  const page = await context.newPage();

  await page.goto(`${baseUrl}/post`, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS });
  await page
    .getByText(POST_TITLE, { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

  const filePath = path.join(root, target);
  const original = fs.readFileSync(filePath, 'utf8');
  let updates = 0;
  let reloads = 0;
  let lastEventAt = null;
  const start = performance.now();

  page.on('console', (message) => {
    const text = message.text();

    if (text.startsWith('[vite] hot updated')) {
      updates += 1;
      lastEventAt = performance.now();
    }
  });
  page.on('load', () => {
    reloads += 1;
    lastEventAt = performance.now();
  });

  fs.writeFileSync(filePath, `${original}\n// hmr-probe\n`);

  try {
    while (performance.now() - start < HMR_TIMEOUT_MS) {
      await sleep(100);

      if (lastEventAt !== null && performance.now() - lastEventAt > HMR_QUIET_MS) {
        break;
      }
    }

    return {
      ms: lastEventAt === null ? null : lastEventAt - start,
      updates,
      reloads,
    };
  } finally {
    fs.writeFileSync(filePath, original);
    await sleep(HMR_QUIET_MS);
    await context.close();
  }
}

function record(out, entry) {
  fs.appendFileSync(
    out,
    `${JSON.stringify({ ...entry, load1m: os.loadavg()[0], at: new Date().toISOString() })}\n`
  );
}

async function runDevSuite(args, chromium) {
  const browser = await chromium.launch();

  for (let round = 0; round < args.rounds; round += 1) {
    for (const variant of rotatedVariants(round)) {
      const root = path.join(args.exp, `barrel-exp-${variant}`);
      const port = PORTS[variant];
      const baseUrl = `http://localhost:${port}`;
      const viteArgs = ['--mode', 'test', '--port', String(port), '--strictPort'];

      // 의존성 사전 번들 캐시를 비운 부팅과 그 뒤 첫 화면
      const cold = await startServer(root, [...viteArgs, '--force']);
      const coldPage = await measurePage(browser, baseUrl, '/post', POST_TITLE);

      await stopServer(cold.child);

      // 평소 개발: 캐시가 있는 부팅, 변환을 처음 하는 첫 화면, 변환 캐시가 있는 새 탭, 상세, HMR
      const warm = await startServer(root, viteArgs);
      const firstPost = await measurePage(browser, baseUrl, '/post', POST_TITLE);
      const newTab = await measurePage(browser, baseUrl, '/post', POST_TITLE);
      const detail = await measurePage(browser, baseUrl, '/post/post-uuid-1', COMMENT_TEXT);
      const hmr = {};

      for (const [name, target] of Object.entries(HMR_TARGETS)) {
        hmr[name] = await measureHmr(browser, baseUrl, root, target);
      }

      await stopServer(warm.child);

      record(args.out, {
        suite: 'dev',
        round,
        variant,
        coldViteReadyMs: cold.viteReadyMs,
        coldWallReadyMs: cold.wallReadyMs,
        coldPage,
        warmViteReadyMs: warm.viteReadyMs,
        warmWallReadyMs: warm.wallReadyMs,
        firstPost,
        newTab,
        detail,
        hmr,
      });
      console.log(
        `dev round=${round} ${variant} boot=${warm.viteReadyMs} first=${Math.round(firstPost.contentMs)} ` +
          `modules=${firstPost.sourceModules} errors=${firstPost.pageErrors.length} failure=${firstPost.failure}`
      );
    }
  }

  await browser.close();
}

async function runToolSuite(args) {
  for (let round = 0; round < args.rounds; round += 1) {
    for (const variant of rotatedVariants(round)) {
      const root = path.join(args.exp, `barrel-exp-${variant}`);
      const build = await timed(root, binIn(root, 'vite'), ['build', '--mode', 'test'], BUILD_ENV);
      const typecheck = await timed(root, binIn(root, 'tsc'), ['-b', '--force', '--noEmit']);
      const test = await timed(root, binIn(root, 'vitest'), ['run', '--project=unit']);
      // "Failed Tests 138 ⎯⎯⎯" 구분선이 아니라 맨 끝 요약 줄을 읽도록 줄 머리에 고정한다
      const counts = (label) =>
        test.output.match(new RegExp(`^\\s*${label}\\s+(.+)$`, 'm'))?.[1]?.trim() ?? null;
      const failedTests = [...new Set(test.output.match(/^\s*FAIL\s+\|unit\|\s+.+$/gm) ?? [])].map(
        (line) => line.replace(/^\s*FAIL\s+\|unit\|\s+/, '').trim()
      );

      record(args.out, {
        suite: 'tool',
        round,
        variant,
        buildMs: build.ms,
        buildCode: build.code,
        typecheckMs: typecheck.ms,
        typecheckCode: typecheck.code,
        testMs: test.ms,
        testCode: test.code,
        testFiles: counts('Test Files'),
        tests: counts('Tests'),
        failedTests,
      });
      console.log(
        `tool round=${round} ${variant} build=${Math.round(build.ms)} tsc=${Math.round(typecheck.ms)} ` +
          `test=${Math.round(test.ms)} codes=${build.code}/${typecheck.code}/${test.code}`
      );
    }
  }
}

function brotliSize(buffer) {
  return brotliCompressSync(buffer, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
}

/** 빌드 산출물의 크기. 첫 로딩은 docs/PERFORMANCE.md "첫 로딩 JS"와 같게 진입 스크립트 + modulepreload를 brotli로 합한다 */
function bundleStats(root) {
  const distDir = path.join(root, 'dist');
  const jsDir = path.join(distDir, 'assets/js');
  const files = fs.readdirSync(jsDir).filter((name) => name.endsWith('.js'));
  const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const firstLoad = [...html.matchAll(/(?:src|href)="\/?(assets\/js\/[^"]+\.js)"/g)].map(
    (match) => match[1]
  );
  const sizes = new Map(
    files.map((name) => {
      const buffer = fs.readFileSync(path.join(jsDir, name));

      return [`assets/js/${name}`, { raw: buffer.length, brotli: brotliSize(buffer) }];
    })
  );
  const sum = (paths, key) =>
    paths.reduce((total, file) => total + (sizes.get(file)?.[key] ?? 0), 0);

  return {
    chunks: files.length,
    totalRaw: sum([...sizes.keys()], 'raw'),
    totalBrotli: sum([...sizes.keys()], 'brotli'),
    firstLoadFiles: firstLoad.length,
    firstLoadRaw: sum(firstLoad, 'raw'),
    firstLoadBrotli: sum(firstLoad, 'brotli'),
    firstLoad: firstLoad.map((file) => path.basename(file).replace(/-[^-]+\.js$/, '')),
    chunkNames: [...sizes.entries()]
      .map(([file, size]) => [path.basename(file).replace(/-[^-]+\.js$/, ''), size.brotli])
      .sort((a, b) => b[1] - a[1]),
  };
}

/** /post에서 실제로 받는 스크립트의 brotli 합(로컬 preview) */
async function postPageScripts(browser, baseUrl, root) {
  const context = await browser.newContext({ serviceWorkers: 'block' });

  await installMocks(context, makeTracker());

  const page = await context.newPage();
  const scripts = new Set();
  const pageErrors = [];

  page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));
  page.on('request', (request) => {
    const url = new URL(request.url());

    // CloudWatch RUM 스크립트처럼 막아 둔 외부 스크립트는 번들이 아니다
    if (request.resourceType() === 'script' && url.hostname === 'localhost') {
      scripts.add(url.pathname.replace(/^\//, ''));
    }
  });

  let failure = null;

  try {
    await page.goto(`${baseUrl}/post`, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS });
    await page
      .getByText(POST_TITLE, { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  } catch (error) {
    failure = error.message.split('\n')[0].slice(0, 200);
  }

  await context.close();

  const files = [...scripts].filter((file) => file.endsWith('.js'));

  return {
    postScripts: files.length,
    postScriptsBrotli: files.reduce(
      (total, file) => total + brotliSize(fs.readFileSync(path.join(root, 'dist', file))),
      0
    ),
    pageErrors,
    failure,
  };
}

async function runBundleSuite(args, chromium) {
  const browser = await chromium.launch();

  for (const variant of VARIANTS) {
    const root = path.join(args.exp, `barrel-exp-${variant}`);
    const build = await timed(root, binIn(root, 'vite'), ['build', '--mode', 'test'], BUILD_ENV);

    if (build.code !== 0) {
      record(args.out, {
        suite: 'bundle',
        variant,
        buildCode: build.code,
        output: build.output.slice(-800),
      });
      console.log(`bundle ${variant} build failed`);
      continue;
    }

    const port = PORTS[variant];
    const server = await startServer(root, [
      'preview',
      '--mode',
      'test',
      '--port',
      String(port),
      '--strictPort',
    ]);
    const scripts = await postPageScripts(browser, `http://localhost:${port}`, root);

    await stopServer(server.child);
    record(args.out, { suite: 'bundle', variant, ...bundleStats(root), ...scripts });
    console.log(`bundle ${variant} done`);
  }

  await browser.close();
}

const LCP_SCRIPT = () => {
  window.__lcp = null;
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1];

    window.__lcp = { startTime: last.startTime, tag: last.element?.tagName ?? null };
  }).observe({ type: 'largest-contentful-paint', buffered: true });
};

/** vite preview를 CPU 4배 감속 모바일로 열어 LCP를 잰다 */
async function measureLcp(browser, devices, baseUrl) {
  const context = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' });

  await installMocks(context, makeTracker());
  await context.addInitScript(LCP_SCRIPT);

  const page = await context.newPage();
  const client = await context.newCDPSession(page);

  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const pageErrors = [];

  page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));

  let lcp = null;
  let failure = null;

  try {
    await page.goto(`${baseUrl}/post`, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS });
    await page
      .getByText(POST_TITLE, { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    lcp = await page.evaluate(() => window.__lcp);
  } catch (error) {
    failure = error.message.split('\n')[0].slice(0, 200);
  }

  await context.close();

  return { lcpMs: lcp?.startTime ?? null, lcpTag: lcp?.tag ?? null, pageErrors, failure };
}

async function runLcpSuite(args, chromium, devices) {
  const browser = await chromium.launch();
  const servers = {};

  for (const variant of VARIANTS) {
    const root = path.join(args.exp, `barrel-exp-${variant}`);

    servers[variant] = await startServer(root, [
      'preview',
      '--mode',
      'test',
      '--port',
      String(PORTS[variant]),
      '--strictPort',
    ]);
  }

  for (let round = 0; round < args.rounds; round += 1) {
    for (const variant of rotatedVariants(round)) {
      const result = await measureLcp(browser, devices, `http://localhost:${PORTS[variant]}`);

      record(args.out, { suite: 'lcp', round, variant, ...result });
      console.log(
        `lcp round=${round} ${variant} ${Math.round(result.lcpMs ?? -1)} ${result.lcpTag} failure=${result.failure}`
      );
    }
  }

  for (const server of Object.values(servers)) {
    await stopServer(server.child);
  }

  await browser.close();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  args.exp = path.resolve(args.exp);

  const require = createRequire(path.join(args.exp, 'barrel-exp-a/package.json'));
  const { chromium, devices } = require('@playwright/test');

  if (args.suite === 'dev') {
    await runDevSuite(args, chromium);
  } else if (args.suite === 'tool') {
    await runToolSuite(args);
  } else if (args.suite === 'bundle') {
    await runBundleSuite(args, chromium);
  } else if (args.suite === 'lcp') {
    await runLcpSuite(args, chromium, devices);
  } else {
    throw new Error(`알 수 없는 suite: ${args.suite}`);
  }
}

await main();
