// measure.mjs가 쌓은 JSONL을 지표별 표로 요약한다(docs/plans/2026-11-07-barrel-measurement.md). 그룹 중앙값끼리
// 빼지 않고 같은 라운드 안의 차이를 모아 중앙값을 낸다(docs/PERFORMANCE.md "폰트 preload 비교"와 같은 방법).
// 판정: 차이의 중앙값이 max(100ms, A의 5%)를 넘고 라운드의 80% 이상에서 같은 방향이면 "차이 있음".
//
// 사용: node scripts/barrel-experiment/report.mjs [--max-load <1분 부하>] <results.jsonl...>
// --max-load를 주면 어느 변형이든 그 부하를 넘은 라운드를 통째로 빼고 계산한다(다른 작업과 겹친 라운드가 판정을 바꾸는지 본다).

import fs from 'node:fs';

const METRICS = {
  dev: {
    'dev 부팅(캐시 없음, vite ready)': (run) => run.coldViteReadyMs,
    'dev 부팅(캐시 있음, vite ready)': (run) => run.warmViteReadyMs,
    '/post 첫 화면(캐시 없는 서버 직후)': (run) => run.coldPage.contentMs,
    '/post load(변환 처음)': (run) => run.firstPost.loadMs,
    '/post 첫 화면(변환 처음)': (run) => run.firstPost.contentMs,
    '/post 새 탭(변환 캐시 있음)': (run) => run.newTab.contentMs,
    '상세 첫 화면': (run) => run.detail.contentMs,
    'HMR 컴포넌트(PostCard)': (run) => run.hmr.component.ms,
    'HMR 쿼리 키(post.keys)': (run) => run.hmr.queryKeys.ms,
    'HMR 문구(texts)': (run) => run.hmr.texts.ms,
  },
  tool: {
    'vite build': (run) => run.buildMs,
    '타입체크(tsc -b --force)': (run) => run.typecheckMs,
    '단위 테스트 전체': (run) => run.testMs,
  },
  lcp: {
    'LCP(preview, CPU 4배 감속)': (run) => run.lcpMs,
  },
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const round = (value) => Math.round(value);

function pairedDiff(rows, variant, read) {
  return rows
    .map((byVariant) => {
      const base = byVariant.a && read(byVariant.a);
      const other = byVariant[variant] && read(byVariant[variant]);

      return typeof base === 'number' && typeof other === 'number' ? other - base : null;
    })
    .filter((value) => value !== null);
}

function verdict(diffs, baseMedian) {
  if (diffs.length === 0) {
    return '값 없음';
  }

  const middle = median(diffs);
  const threshold = Math.max(100, baseMedian * 0.05);
  const sameDirection = diffs.filter((value) => Math.sign(value) === Math.sign(middle)).length;
  const required = Math.ceil(diffs.length * 0.8);

  if (Math.abs(middle) > threshold && sameDirection >= required) {
    return `차이 있음(${middle > 0 ? '느림' : '빠름'})`;
  }

  return '노이즈 범위';
}

const args = process.argv.slice(2);
const maxLoadFlag = args.indexOf('--max-load');
const maxLoad = maxLoadFlag === -1 ? Infinity : Number(args[maxLoadFlag + 1]);
const files =
  maxLoadFlag === -1
    ? args
    : args.filter((_, index) => index < maxLoadFlag || index > maxLoadFlag + 1);

const allRuns = files
  .flatMap((file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean))
  .map((line) => JSON.parse(line));
const overloaded = new Set(
  allRuns.filter((run) => run.load1m > maxLoad).map((run) => `${run.suite}:${run.round}`)
);
const runs = allRuns.filter((run) => !overloaded.has(`${run.suite}:${run.round}`));

for (const [suite, metrics] of Object.entries(METRICS)) {
  const suiteRuns = runs.filter((run) => run.suite === suite);

  if (suiteRuns.length === 0) {
    continue;
  }

  const rounds = new Map();

  for (const run of suiteRuns) {
    rounds.set(run.round, { ...rounds.get(run.round), [run.variant]: run });
  }

  const rows = [...rounds.values()];

  console.log(
    `\n## ${suite} (${rows.length}라운드, 1분 부하 중앙값 ${median(suiteRuns.map((run) => run.load1m)).toFixed(1)})\n`
  );
  console.log(
    '| 지표 | A 중앙값(범위) | B 중앙값 | C 중앙값 | B−A(같은 방향) | C−A(같은 방향) | B 판정 | C 판정 |'
  );
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const [name, read] of Object.entries(metrics)) {
    const values = (variant) =>
      suiteRuns
        .filter((run) => run.variant === variant)
        .map(read)
        .filter((value) => typeof value === 'number');
    const a = values('a');

    if (a.length === 0) {
      console.log(`| ${name} | 값 없음 | | | | | | |`);
      continue;
    }

    const baseMedian = median(a);
    const describe = (variant) => {
      const diffs = pairedDiff(rows, variant, read);

      if (diffs.length === 0) {
        return '값 없음';
      }

      const middle = median(diffs);
      const same = diffs.filter((value) => Math.sign(value) === Math.sign(middle)).length;

      return `${middle > 0 ? '+' : ''}${round(middle)}ms(${same}/${diffs.length})`;
    };
    const medianOf = (variant) =>
      values(variant).length ? `${round(median(values(variant)))}ms` : '값 없음';

    console.log(
      `| ${name} | ${round(baseMedian)}ms(${round(Math.min(...a))}~${round(Math.max(...a))}) | ${medianOf('b')} | ${medianOf('c')} | ` +
        `${describe('b')} | ${describe('c')} | ${verdict(pairedDiff(rows, 'b', read), baseMedian)} | ${verdict(pairedDiff(rows, 'c', read), baseMedian)} |`
    );
  }

  if (suite === 'dev') {
    console.log(
      '\n| 변형 | /post 모듈 요청 | 상세 모듈 요청 | HMR 갱신 수(컴포넌트/쿼리 키/문구) | 전체 새로고침(컴포넌트/쿼리 키/문구) | 배럴 요청 | 페이지 오류 | 외부 차단 | 모킹 안 된 API |'
    );
    console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');

    for (const variant of ['a', 'b', 'c']) {
      const own = suiteRuns.filter((run) => run.variant === variant);

      if (own.length === 0) {
        continue;
      }

      const med = (read) => median(own.map(read));

      console.log(
        `| ${variant.toUpperCase()} | ${med((run) => run.firstPost.sourceModules)} | ${med((run) => run.detail.sourceModules)} | ` +
          `${med((run) => run.hmr.component.updates)}/${med((run) => run.hmr.queryKeys.updates)}/${med((run) => run.hmr.texts.updates)} | ` +
          `${med((run) => run.hmr.component.reloads)}/${med((run) => run.hmr.queryKeys.reloads)}/${med((run) => run.hmr.texts.reloads)} | ` +
          `${own.every((run) => run.firstPost.barrelRequested)} | ${own.reduce((sum, run) => sum + run.firstPost.pageErrors.length + run.detail.pageErrors.length, 0)} | ` +
          `${med((run) => run.firstPost.externalBlocked)} | ${[...new Set(own.flatMap((run) => run.firstPost.unmockedApi))].join(', ') || '없음'} |`
      );
    }
  }

  if (suite === 'tool') {
    console.log('\n| 변형 | 종료 코드(빌드/타입/테스트) | Test Files | Tests |');
    console.log('| --- | --- | --- | --- |');

    for (const variant of ['a', 'b', 'c']) {
      const last = suiteRuns.filter((run) => run.variant === variant).at(-1);

      if (last) {
        console.log(
          `| ${variant.toUpperCase()} | ${last.buildCode}/${last.typecheckCode}/${last.testCode} | ${last.testFiles} | ${last.tests} |`
        );
      }
    }
  }
}

const bundleRuns = runs.filter((run) => run.suite === 'bundle');

if (bundleRuns.length > 0) {
  const kb = (bytes) => (bytes / 1024).toFixed(2);

  console.log('\n## bundle\n');
  console.log(
    '| 변형 | 청크 수 | 전체 JS(raw KB) | 전체 JS(brotli KB) | 첫 로딩 파일 수 | 첫 로딩(raw KB) | 첫 로딩(brotli KB) | /post 스크립트 수 | /post 스크립트(brotli KB) | 페이지 오류 |'
  );
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const run of bundleRuns) {
    if (run.chunks === undefined) {
      console.log(
        `| ${run.variant.toUpperCase()} | 빌드 실패(코드 ${run.buildCode}) | | | | | | | | |`
      );
      continue;
    }

    console.log(
      `| ${run.variant.toUpperCase()} | ${run.chunks} | ${kb(run.totalRaw)} | ${kb(run.totalBrotli)} | ${run.firstLoadFiles} | ${kb(run.firstLoadRaw)} | ${kb(run.firstLoadBrotli)} | ${run.postScripts} | ${kb(run.postScriptsBrotli)} | ${run.pageErrors.length}${run.failure ? ` / 실패: ${run.failure}` : ''} |`
    );
  }
}
