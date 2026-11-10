// 뒤로가기로 닫히는 오버레이(피드 카드의 북마크 폴더 창, 폰의 왼쪽 메뉴, 로그인 창)를 여닫는 시간을 두 빌드에서
// 번갈아 잰다(docs/BACK-NAVIGATION.md 9장, docs/plans/2026-11-10-back-navigation-standard.md 판단 11). 운영 API를
// 때리지 않도록 /api는 전부 모킹하고 localhost 밖 요청은 막는다(scripts/barrel-experiment/measure.mjs와 같은 방식).
//
//   caffeinate -i node scripts/back-overlay-measure/measure.mjs \
//     --baseline <기준 체크아웃> --target <대상 체크아웃> --out <결과 JSON> \
//     [--overlay bookmark|sidebar|login] [--runs 10] [--quick 4]
//
// 두 체크아웃 모두 pnpm install이 끝나 있어야 한다. 운영 빌드(vite build --mode test)와 preview 서버는 이
// 스크립트가 만들고 띄운다. --runs·--quick은 블록 하나의 횟수다(블록 3개, 빌드 순서를 블록마다 바꾼다).
// --overlay를 안 주면 북마크 폴더 창을 잰다.

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const VARIANTS = ['baseline', 'target'];
const PORTS = { baseline: 31911, target: 31912 };
const CPU_RATES = [1, 4];
const BLOCKS = 3;
const WARMUP_RUNS = 3;
const PAGE_TIMEOUT_MS = 60_000;
// dialog.tsx는 열린 직후의 클릭을 삼킨다(DOUBLE_CLICK_GUARD_MS 400ms) - 닫기 버튼을 누르기 전에 그만큼 기다린다
const CLICK_GUARD_WAIT_MS = 450;
// 배포와 같게 CI=true로 돌려 로컬 전용 번들 분석 리포트를 빼고, 운영처럼 같은 출처의 /api를 부르게 한다.
// 앱이 읽는 나머지 값(Firebase 설정)도 여기서 넘긴다 - 프로세스 환경 변수가 .env 파일보다 앞서므로 두 체크아웃의
// .env 유무와 상관없이 같은 조건으로 빌드된다. 실제 FCM을 쓰지 않아 playwright.config.ts의 webServer.env와 같은
// 더미 값이다
const BUILD_ENV = {
  CI: 'true',
  VITE_API_BASE_URL: '/api',
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
  VITE_FIREBASE_VAPID_KEY: 'test-vapid-key',
};
// TEXTS.ariaLabels.close - 문구가 바뀌면 버튼을 못 찾아 바로 실패한다(아래 openerName도 같다)
const LABEL_CLOSE = '닫기';
const POST_COUNT = 12;
const FOLDER_COUNT = 25;
const HAS_SESSION_KEY = 'linksphere:auth:has-session';
// 재는 오버레이마다 다른 것. surface는 열림을 DOM에서 읽는 방법이다 - dialog는 Radix Dialog, drawer는 늘 마운트된
// 채 클래스로 여닫는 메뉴 패널(Sidebar.tsx)
const OVERLAYS = {
  // 피드 카드의 북마크 폴더 창. 기준 빌드가 입력 장치로 경로를 갈랐던 창이라 마우스·터치를 다 잰다
  bookmark: {
    viewport: { width: 1280, height: 800 },
    inputs: ['mouse', 'touch'],
    signedIn: true,
    // TEXTS.ariaLabels.bookmarkSave
    openerName: '북마크 저장',
    surface: 'dialog',
  },
  // 폰의 왼쪽 메뉴. 폭이 좁을 때만 있다(Playwright Pixel 5의 화면 크기)
  sidebar: {
    viewport: { width: 393, height: 727 },
    inputs: ['touch'],
    signedIn: true,
    // TEXTS.nav.openMenu
    openerName: '메뉴 열기',
    surface: 'drawer',
  },
  // 내비게이션 바 [로그인]의 로그인 창. 그 버튼은 로그인하지 않았을 때만 있다
  login: {
    viewport: { width: 1280, height: 800 },
    inputs: ['mouse'],
    signedIn: false,
    // TEXTS.nav.logIn
    openerName: '로그인',
    surface: 'dialog',
  },
};
// 닫힌 뒤 다음 회차로 가기 전에 기다리는 상태. 창은 닫힘 애니메이션 뒤 DOM에서 빠지고, 메뉴는 남아서 숨는다
const GONE_STATE = { dialog: 'detached', drawer: 'hidden' };

function parseArgs(argv) {
  const args = { runs: 10, quick: 4, overlay: 'bookmark' };

  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }

  args.runs = Number(args.runs);
  args.quick = Number(args.quick);

  if (!args.baseline || !args.target || !args.out) {
    throw new Error('--baseline, --target, --out 이 필요하다');
  }

  if (!OVERLAYS[args.overlay]) {
    throw new Error(`--overlay는 ${Object.keys(OVERLAYS).join(', ')} 중 하나여야 한다`);
  }

  return args;
}

const stripAnsi = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

function makePost(index) {
  return {
    id: `post-uuid-${index}`,
    url: `https://example.com/article-${index}`,
    title: `Back Overlay Measure Post ${index}`,
    description: 'A post used to measure opening the bookmark folder dialog',
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
    author: { id: 'user-uuid-2', nickname: 'otheruser' },
  };
}

const POSTS = Array.from({ length: POST_COUNT }, (_, index) => makePost(index + 1));
const FOLDERS = Array.from({ length: FOLDER_COUNT }, (_, index) => ({
  id: `folder-uuid-${index + 1}`,
  name: `Folder ${index + 1}`,
  sortOrder: index,
  bookmarkCount: index,
}));
const ACCOUNT = {
  id: 'user-uuid-1',
  nickname: 'testuser',
  role: 'USER',
  emailVerified: true,
  email: 'testuser@example.com',
};

const envelope = (data) => ({
  status: 200,
  message: 'ok',
  data,
  timestamp: '2025-01-01T00:00:00.000Z',
});

/** 앱이 부르는 API만 응답하고 나머지는 e2e catch-all처럼 끊는다(로그인 상태) */
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

      if (url.pathname === '/api/auth/refresh') {
        await route.fulfill({
          json: envelope({ accessToken: 'measure-access-token', deletionCancelled: false }),
        });
      } else if (url.pathname === '/api/auth/account') {
        await route.fulfill({ json: envelope(ACCOUNT) });
      } else if (url.pathname === '/api/post') {
        await route.fulfill({ json: envelope({ content: POSTS, nextCursor: null }) });
      } else if (url.pathname === '/api/common/category-option') {
        await route.fulfill({ json: envelope(POSTS[0].categories) });
      } else if (url.pathname === '/api/bookmark/folders') {
        await route.fulfill({ json: envelope({ folders: FOLDERS, uncategorizedCount: 0 }) });
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

function run(root, command, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env } });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('close', (code) => {
      resolve({ code, output: stripAnsi(output) });
    });
  });
}

/** vite preview를 띄우고 ready 줄을 기다린다 */
function startServer(root, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      binIn(root, 'vite'),
      ['preview', '--mode', 'test', '--port', String(port), '--strictPort'],
      { cwd: root, env: process.env }
    );
    let output = '';

    // 측정기가 오류로 끝나도 서버를 남기지 않는다(남으면 다음 실행의 --strictPort가 실패한다)
    process.once('exit', () => child.kill('SIGKILL'));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`서버 시작 시간 초과: ${stripAnsi(output).slice(-400)}`));
    }, PAGE_TIMEOUT_MS);

    const onData = (chunk) => {
      output += chunk;

      if (/Local:\s+http/.test(stripAnsi(output))) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolve(child);
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

/**
 * 페이지 안에서 도는 계측. 운영 빌드의 React도 전역 DevTools 훅이 있으면 커밋마다 알려 준다 - 그때 이번 커밋에서
 * 다시 그린 컴포넌트를 센다(React DevTools와 같은 판정: 이전 트리와 자식이 같은 가지는 건너뛰고, 다시 그린
 * 컴포넌트에는 PerformedWork 표시가 있다).
 */
const PAGE_SCRIPT = ({ hasSessionKey, signedIn, surface }) => {
  const PERFORMED_WORK = 1;
  // FunctionComponent, ClassComponent, ForwardRef, MemoComponent, SimpleMemoComponent
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]);
  const QUIET_MS = 300;
  const SETTLE_LIMIT_MS = 5_000;
  const commits = [];

  if (signedIn) {
    window.localStorage.setItem(hasSessionKey, 'true');
  }

  function countRendered(rootFiber) {
    const stack = [rootFiber];
    let count = 0;

    while (stack.length > 0) {
      const next = stack.pop();
      const previous = next.alternate;
      const isMount = previous === null;

      if (COMPONENT_TAGS.has(next.tag) && (isMount || (next.flags & PERFORMED_WORK) !== 0)) {
        count += 1;
      }

      if (isMount || next.child !== previous.child) {
        for (let child = next.child; child !== null; child = child.sibling) {
          stack.push(child);
        }
      }
    }

    return count;
  }

  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer) {
      this.renderers.set(this.renderers.size + 1, renderer);

      return this.renderers.size;
    },
    onCommitFiberRoot(_rendererId, root) {
      commits.push({ time: performance.now(), rendered: countRendered(root.current) });
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };

  // 메뉴 패널은 닫혀도 DOM에 남는다 - 열렸을 때만 붙는 클래스로 본다(Sidebar.tsx)
  const isOverlayOpen =
    surface === 'drawer'
      ? () => document.querySelector('aside.z-drawer.translate-x-0') !== null
      : () => document.querySelector('[role="dialog"][data-state="open"]') !== null;

  const sumCommits = (from, untilTime) => {
    const picked = commits.slice(from).filter((commit) => commit.time <= untilTime);

    return {
      count: picked.length,
      rendered: picked.reduce((total, commit) => total + commit.rendered, 0),
    };
  };

  let current = null;

  window.__measure = {
    /**
     * 다음 입력(inputType 이벤트)부터 창이 wantOpen 상태가 된 첫 프레임까지를 잰다. 그 뒤 커밋이 QUIET_MS 동안
     * 없을 때까지 프레임 간격과 커밋을 계속 모은다(뒤에서 도는 페이지 다시 그리기까지 본다).
     */
    arm(wantOpen, inputType) {
      if (current) {
        current.cancelled = true;
      }

      const session = { cancelled: false };
      const firstCommitIndex = commits.length;
      let inputTime = null;
      let frameTime = null;
      let lastFrameTime = null;
      let longestGap = 0;
      let resolveReached = () => {};
      let resolveSettled = () => {};

      session.reached = new Promise((resolve) => {
        resolveReached = resolve;
      });
      session.settled = new Promise((resolve) => {
        resolveSettled = resolve;
      });

      const tick = () => {
        if (session.cancelled) {
          return;
        }

        const now = performance.now();

        longestGap = Math.max(longestGap, now - lastFrameTime);
        lastFrameTime = now;

        if (frameTime === null && isOverlayOpen() === wantOpen) {
          frameTime = now;
          resolveReached(frameTime - inputTime);
        }

        const lastCommitTime = commits.length > 0 ? commits[commits.length - 1].time : 0;
        const quietSince = Math.max(frameTime ?? now, lastCommitTime);
        const isSettled = frameTime !== null && now - quietSince >= QUIET_MS;

        if (isSettled || now - inputTime > SETTLE_LIMIT_MS) {
          // 끝내 상태가 안 바뀌었으면 null로 알린다 - 기다리는 쪽이 멈추지 않고 실패로 처리한다
          resolveReached(null);
          resolveSettled({
            ms: frameTime === null ? null : frameTime - inputTime,
            longestFrameGapMs: longestGap,
            untilFrame: sumCommits(firstCommitIndex, frameTime ?? now),
            total: sumCommits(firstCommitIndex, now),
            historyIndex: window.history.state?.idx ?? null,
          });

          return;
        }

        requestAnimationFrame(tick);
      };

      window.addEventListener(
        inputType,
        (event) => {
          inputTime = event.timeStamp;
          lastFrameTime = event.timeStamp;
          requestAnimationFrame(tick);
        },
        { capture: true, once: true }
      );

      current = session;
    },
    reached: () => current.reached,
    settled: () => current.settled,
    historyIndex: () => window.history.state?.idx ?? null,
    device: () => ({
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      closeWatcher: 'CloseWatcher' in window,
    }),
  };
};

async function openSession(browser, baseUrl, overlay, input, cpuRate) {
  const context = await browser.newContext({
    viewport: overlay.viewport,
    hasTouch: input === 'touch',
    serviceWorkers: 'block',
  });
  const tracker = { externalBlocked: 0, unmockedApi: new Set() };

  await installMocks(context, tracker);
  await context.addInitScript(PAGE_SCRIPT, {
    hasSessionKey: HAS_SESSION_KEY,
    signedIn: overlay.signedIn,
    surface: overlay.surface,
  });

  const page = await context.newPage();
  const pageErrors = [];

  page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));

  await page.goto(`${baseUrl}/post`, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS });
  // 첫 카드로 기다린다 - 폭이 좁으면 한 줄에 한 장이라 마지막 카드는 가상 스크롤 밖이어서 DOM에 없다
  await page
    .getByText(POSTS[0].title, { exact: true })
    .first()
    .waitFor({ state: 'attached', timeout: PAGE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  const client = await context.newCDPSession(page);

  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });

  return { context, page, tracker, pageErrors };
}

async function press(page, locator, input) {
  if (input === 'touch') {
    await locator.tap();

    return;
  }

  await locator.click();
}

function getOpener(page, overlay) {
  return page.getByRole('button', { name: overlay.openerName }).first();
}

function getSurface(page, overlay) {
  return overlay.surface === 'drawer' ? page.locator('aside.z-drawer') : page.getByRole('dialog');
}

/** 열기 → (가드 대기) → X로 닫기 한 번 */
async function measureOpenClose(page, overlay, input) {
  const indexBefore = await page.evaluate(() => window.__measure.historyIndex());

  await page.evaluate(() => window.__measure.arm(true, 'click'));
  await press(page, getOpener(page, overlay), input);

  const open = await page.evaluate(() => window.__measure.settled());

  // 메뉴에는 그 가드가 없지만 오버레이끼리 조건을 같게 두려고 똑같이 기다린다
  await page.waitForTimeout(CLICK_GUARD_WAIT_MS);
  await page.evaluate(() => window.__measure.arm(false, 'click'));
  await press(page, getSurface(page, overlay).getByRole('button', { name: LABEL_CLOSE }), input);

  const close = await page.evaluate(() => window.__measure.settled());

  if (open.ms === null || close.ms === null) {
    throw new Error(`창이 ${open.ms === null ? '열리지' : '닫히지'} 않았다 - 측정을 멈춘다`);
  }

  return {
    open,
    close,
    pushedHistory: open.historyIndex !== indexBefore,
    indexRestored: close.historyIndex === indexBefore,
  };
}

/** 창이 뜬 첫 프레임에 바로 Esc - 열면서 시작한 페이지 다시 그리기가 도는 중에도 닫기가 먹는지 본다 */
async function measureQuickClose(page, overlay, input) {
  const indexBefore = await page.evaluate(() => window.__measure.historyIndex());

  await page.evaluate(() => window.__measure.arm(true, 'click'));
  await press(page, getOpener(page, overlay), input);

  if ((await page.evaluate(() => window.__measure.reached())) === null) {
    throw new Error('창이 열리지 않았다 - 측정을 멈춘다');
  }

  await page.evaluate(() => window.__measure.arm(false, 'keydown'));
  await page.keyboard.press('Escape');

  const close = await page.evaluate(() => window.__measure.settled());

  // 닫힘 애니메이션이 끝나 창이 사라질 때까지 기다린 뒤 다음 회차로 간다
  await getSurface(page, overlay).waitFor({ state: GONE_STATE[overlay.surface], timeout: 5_000 });

  return { ms: close.ms, indexRestored: close.historyIndex === indexBefore };
}

async function runSession(browser, baseUrl, overlay, session, args) {
  const { context, page, tracker, pageErrors } = await openSession(
    browser,
    baseUrl,
    overlay,
    session.input,
    session.cpuRate
  );
  const device = await page.evaluate(() => window.__measure.device());
  const runs = [];
  const quickCloses = [];

  for (let run = 0; run < WARMUP_RUNS + args.runs; run += 1) {
    const result = await measureOpenClose(page, overlay, session.input);

    // 첫 회차들은 버린다 - 창 코드(lazy 청크)와 폴더 목록을 처음 받는 시간이 섞인다
    if (run >= WARMUP_RUNS) {
      runs.push(result);
    }

    await getSurface(page, overlay).waitFor({ state: GONE_STATE[overlay.surface], timeout: 5_000 });
  }

  for (let run = 0; run < args.quick; run += 1) {
    quickCloses.push(await measureQuickClose(page, overlay, session.input));
  }

  await context.close();

  return {
    ...session,
    ...device,
    runs,
    quickCloses,
    pageErrors,
    externalBlocked: tracker.externalBlocked,
    unmockedApi: [...tracker.unmockedApi],
  };
}

function median(values) {
  const sorted = values.filter((value) => value !== null).sort((a, b) => a - b);

  if (sorted.length === 0) {
    return null;
  }

  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);

function summarize(sessions, inputs) {
  const summary = [];

  for (const variant of VARIANTS) {
    for (const input of inputs) {
      for (const cpuRate of CPU_RATES) {
        const matched = sessions.filter(
          (session) =>
            session.variant === variant && session.input === input && session.cpuRate === cpuRate
        );
        const runs = matched.flatMap((session) => session.runs);
        const quickCloses = matched.flatMap((session) => session.quickCloses);

        summary.push({
          variant,
          input,
          cpuRate,
          runs: runs.length,
          pushedHistory: runs.filter((run) => run.pushedHistory).length,
          indexNotRestored: runs.filter((run) => !run.indexRestored).length,
          openMs: round1(median(runs.map((run) => run.open.ms))),
          closeMs: round1(median(runs.map((run) => run.close.ms))),
          openLongestFrameGapMs: round1(median(runs.map((run) => run.open.longestFrameGapMs))),
          openRenderedUntilFrame: median(runs.map((run) => run.open.untilFrame.rendered)),
          openRenderedTotal: median(runs.map((run) => run.open.total.rendered)),
          closeRenderedUntilFrame: median(runs.map((run) => run.close.untilFrame.rendered)),
          closeRenderedTotal: median(runs.map((run) => run.close.total.rendered)),
          quickCloses: quickCloses.length,
          quickCloseMs: round1(median(quickCloses.map((quick) => quick.ms))),
          quickCloseIndexNotRestored: quickCloses.filter((quick) => !quick.indexRestored).length,
        });
      }
    }
  }

  return summary;
}

/** 결과 파일에 싣는 원자료. 회차를 객체로 두면 파일이 수천 줄이 되어, 지표마다 회차 순서의 배열로 눕힌다 */
function toColumns(session) {
  const { runs, quickCloses, ...rest } = session;

  return {
    ...rest,
    pushedHistory: runs.filter((run) => run.pushedHistory).length,
    indexNotRestored: runs.filter((run) => !run.indexRestored).length,
    openMs: runs.map((run) => round1(run.open.ms)),
    closeMs: runs.map((run) => round1(run.close.ms)),
    openLongestFrameGapMs: runs.map((run) => round1(run.open.longestFrameGapMs)),
    openRenderedUntilFrame: runs.map((run) => run.open.untilFrame.rendered),
    openRenderedTotal: runs.map((run) => run.open.total.rendered),
    closeRenderedUntilFrame: runs.map((run) => run.close.untilFrame.rendered),
    closeRenderedTotal: runs.map((run) => run.close.total.rendered),
    quickCloseMs: quickCloses.map((quick) => round1(quick.ms)),
    quickCloseIndexNotRestored: quickCloses.filter((quick) => !quick.indexRestored).length,
  };
}

function describeCheckout(root) {
  const git = (...gitArgs) =>
    execFileSync('git', ['-C', root, ...gitArgs])
      .toString()
      .trim();

  return {
    commit: git('rev-parse', 'HEAD'),
    uncommittedFiles: git('status', '--porcelain').split('\n').filter(Boolean).length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const overlay = OVERLAYS[args.overlay];
  const roots = { baseline: path.resolve(args.baseline), target: path.resolve(args.target) };
  const require = createRequire(path.join(roots.target, 'package.json'));
  const { chromium } = require('@playwright/test');
  const servers = {};

  for (const variant of VARIANTS) {
    const build = await run(
      roots[variant],
      binIn(roots[variant], 'vite'),
      ['build', '--mode', 'test'],
      BUILD_ENV
    );

    if (build.code !== 0) {
      throw new Error(`${variant} 빌드 실패: ${build.output.slice(-800)}`);
    }

    servers[variant] = await startServer(roots[variant], PORTS[variant]);
    console.log(`${variant} 빌드·서버 준비 (${PORTS[variant]})`);
  }

  const browser = await chromium.launch();
  const chromiumVersion = browser.version();
  const sessions = [];

  for (const cpuRate of CPU_RATES) {
    for (const input of overlay.inputs) {
      for (let block = 0; block < BLOCKS; block += 1) {
        // 블록마다 시작하는 빌드를 바꿔 예열·발열 편향을 줄인다
        const order = block % 2 === 0 ? VARIANTS : [...VARIANTS].reverse();

        for (const variant of order) {
          const session = await runSession(
            browser,
            `http://localhost:${PORTS[variant]}`,
            overlay,
            { variant, input, cpuRate, block },
            args
          );

          sessions.push(session);
          console.log(
            `cpu=${cpuRate}x ${input} block=${block} ${variant} ` +
              `open=${round1(median(session.runs.map((run) => run.open.ms)))}ms ` +
              `close=${round1(median(session.runs.map((run) => run.close.ms)))}ms ` +
              `errors=${session.pageErrors.length} unmocked=${session.unmockedApi.length}`
          );
        }
      }
    }
  }

  await browser.close();

  for (const server of Object.values(servers)) {
    await stopServer(server);
  }

  const result = {
    measuredAt: new Date().toISOString(),
    conditions: {
      overlay: args.overlay,
      signedIn: overlay.signedIn,
      viewport: `${overlay.viewport.width}x${overlay.viewport.height}`,
      posts: POST_COUNT,
      folders: FOLDER_COUNT,
      blocks: BLOCKS,
      runsPerBlock: args.runs,
      quickClosesPerBlock: args.quick,
      warmupRuns: WARMUP_RUNS,
      node: process.version,
      chromium: chromiumVersion,
      machine: `${os.cpus()[0]?.model ?? 'unknown'} x${os.cpus().length}, ${os.platform()} ${os.release()}`,
    },
    checkouts: {
      baseline: describeCheckout(roots.baseline),
      target: describeCheckout(roots.target),
    },
    summary: summarize(sessions, overlay.inputs),
    sessions: sessions.map(toColumns),
  };

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(path.resolve(args.out), `${JSON.stringify(result, null, 2)}\n`);
  console.table(
    result.summary.map((row) => ({
      variant: row.variant,
      input: row.input,
      cpu: `${row.cpuRate}x`,
      'open ms': row.openMs,
      'close ms': row.closeMs,
      'open gap ms': row.openLongestFrameGapMs,
      'open rendered': `${row.openRenderedUntilFrame} / ${row.openRenderedTotal}`,
      'close rendered': `${row.closeRenderedUntilFrame} / ${row.closeRenderedTotal}`,
      'quick close ms': row.quickCloseMs,
      history: `${row.pushedHistory}/${row.runs}`,
    }))
  );
}

await main();
