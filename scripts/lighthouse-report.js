// CI(ci.yml의 lighthouse job)가 PR마다 쓰는 Lighthouse CI 보고 스크립트. `lhci autorun`이 남긴
// .lighthouseci/의 결과(lhr-*.json, assertion-results.json, links.json — 파일명은 @lhci/utils
// saved-reports.js)를 GitHub Step Summary·PR 댓글용 마크다운으로 바꾼다. 예전엔 결과가 job 원본 로그에만
// 있어 Best Practices가 떨어져도 아무도 못 봤다(docs/plans/2026-10-26-lighthouse-best-practices.md).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const HEADING = '## Lighthouse CI';
const CATEGORIES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best-practices', 'Best Practices'],
  ['seo', 'SEO'],
];
const LHR_FILE_PATTERN = /^lhr-\d+\.json$/;

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function pathOf(url) {
  const { pathname, search } = new URL(url);

  return `${pathname}${search}`;
}

function formatValue(value) {
  if (Number.isNaN(value)) {
    return '측정 실패';
  }

  // 카테고리 점수(0~1)는 소수 둘째 자리까지, 바이트·밀리초는 정수로 보인다.
  return Math.abs(value) <= 1 ? value.toFixed(2) : Math.round(value).toLocaleString('en-US');
}

/** LHCI는 assertion·리포트 링크를 finalUrl 기준으로 묶는다 — 같은 기준으로 실행 결과를 묶는다. */
function groupRunsByUrl(lhrs) {
  const runsByUrl = new Map();

  for (const lhr of lhrs) {
    runsByUrl.set(lhr.finalUrl, [...(runsByUrl.get(lhr.finalUrl) ?? []), lhr]);
  }

  return runsByUrl;
}

function categoryMedian(runs, categoryId) {
  const scores = runs
    .map((lhr) => lhr.categories[categoryId]?.score)
    .filter((score) => typeof score === 'number');

  return scores.length ? String(Math.round(median(scores) * 100)) : '-';
}

/** 가중치가 있는 Best Practices 감사 중 실행 과반에서 실패한 것 — 한 번만 흔들린 감사는 뺀다. */
function failingBestPracticeAudits(runs) {
  const { auditRefs } = runs[0].categories['best-practices'] ?? { auditRefs: [] };

  return auditRefs
    .filter((ref) => ref.weight > 0)
    .filter((ref) => {
      const failedRuns = runs.filter((lhr) => {
        const audit = lhr.audits[ref.id];
        return audit && audit.scoreDisplayMode !== 'notApplicable' && audit.score !== 1;
      });

      return failedRuns.length > runs.length / 2;
    })
    .map((ref) => `${runs[0].audits[ref.id].title} (\`${ref.id}\`, 가중치 ${ref.weight})`);
}

/** job 로그의 LHCI 표기(`resource-summary.font.size`)와 같게 쓴다. auditProperty는 이미 점으로 이어진 문자열이다. */
function assertionName({ auditId, auditProperty }) {
  return auditProperty ? `${auditId}.${auditProperty}` : auditId;
}

function buildReport(lhciDir) {
  const lhrs = fs.existsSync(lhciDir)
    ? fs
        .readdirSync(lhciDir)
        .filter((file) => LHR_FILE_PATTERN.test(file))
        .map((file) => readJson(path.join(lhciDir, file)))
    : [];

  if (lhrs.length === 0) {
    return `${HEADING}\n\n측정 결과가 없다(빌드나 측정이 실패했다). job 로그를 확인한다.`;
  }

  const runsByUrl = groupRunsByUrl(lhrs);
  const links = readJson(path.join(lhciDir, 'links.json'), {});
  const failedAssertions = readJson(path.join(lhciDir, 'assertion-results.json'), []).filter(
    (result) => !result.passed
  );

  const scoreRows = [...runsByUrl].map(([url, runs]) => {
    const scores = CATEGORIES.map(([id]) => categoryMedian(runs, id));
    const link = links[url] ? `[보기](${links[url]})` : '-';

    return `| \`${pathOf(url)}\` | ${scores.join(' | ')} | ${link} |`;
  });
  const assertionRows = failedAssertions.map(
    (result) =>
      `| ${result.level} | \`${pathOf(result.url)}\` | \`${assertionName(result)}\` | ${formatValue(result.actual)} | ${result.operator} ${formatValue(result.expected)} |`
  );
  const auditItems = [...runsByUrl].flatMap(([url, runs]) =>
    failingBestPracticeAudits(runs).map((audit) => `- \`${pathOf(url)}\`: ${audit}`)
  );
  const runCount = Math.max(...[...runsByUrl.values()].map((runs) => runs.length));

  const sections = [
    HEADING,
    `이 PR 빌드를 localhost 프리뷰로 페이지마다 ${runCount}회 잰 카테고리별 중앙값이다(\`lighthouserc.cjs\`). ` +
      `Best Practices는 ${runCount}회 중 가장 좋은 실행도 0.9 미만이면 job이 실패하지만 필수 체크가 아니라 병합은 막지 않는다. 나머지 기준은 경고만 한다.`,
    `| 페이지 | ${CATEGORIES.map(([, label]) => label).join(' | ')} | 리포트 |\n| --- | ${CATEGORIES.map(() => '---').join(' | ')} | --- |\n${scoreRows.join('\n')}`,
    assertionRows.length
      ? `**기준을 못 넘은 항목**\n\n| 수준 | 페이지 | 항목 | 측정값 | 기준 |\n| --- | --- | --- | --- | --- |\n${assertionRows.join('\n')}`
      : '모든 기준을 넘었다.',
    auditItems.length
      ? `**Best Practices에서 실패한 감사**(실행 과반)\n\n${auditItems.join('\n')}`
      : '',
    '리포트 링크는 LHCI 임시 저장소라 며칠 뒤 지워진다. 원본 JSON·HTML은 job 아티팩트 `lighthouse-report`에 있다. ' +
      '이 측정은 빈 프로필이라 측정자 쿠키 저장소에 따라 달라지는 감점은 보이지 않는다(`docs/PERFORMANCE.md` "Best Practices 77점 사례").',
  ];

  return sections.filter(Boolean).join('\n\n');
}

function main() {
  const [lhciDir = path.join(ROOT, '.lighthouseci')] = process.argv.slice(2);

  console.log(buildReport(path.resolve(lhciDir)));
}

main();
