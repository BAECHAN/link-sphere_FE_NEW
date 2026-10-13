// CI(ci.yml의 mutation job)가 PR마다 쓰는 뮤테이션 테스트 보조 스크립트. 두 가지 모드가 있다.
// `--targets <기준 커밋>`은 이 PR이 바꾼 로직 파일(.ts)과, 테스트만 바뀐 경우 같은 폴더의 짝 원본을
// 한 줄에 하나씩 출력한다. `--report <mutation.json> <대상 목록 파일>`은 Stryker JSON 보고서를
// GitHub Step Summary·PR 댓글용 마크다운으로 바꾼다. 머지를 막지 않는 정보용 보고다
// (docs/plans/2026-10-13-mutation-ci-report.md, docs/TESTING.md "뮤테이션 테스트").
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const HEADING = '## 뮤테이션 테스트 (정보용 — 머지를 막지 않음)';

/** 대상에서 빼는 .ts 파일. 테스트 인프라·생성 타입은 로직이 아니고, 테스트·스토리는 뮤테이션 대상이 아니다. */
const EXCLUDED_PATTERN =
  /^src\/(test\/|mocks\/|shared\/api\/generated\/)|\.(test|spec|stories)\.ts$|\.d\.ts$/;
const TEST_FILE_PATTERN = /\.(test|spec)\.tsx?$/;

/** 파일당 목록에 적는 뮤턴트 상한. 넘으면 개수만 적는다. */
const MAX_LISTED_MUTANTS = 40;
/** 보고 전체 길이 상한. 넘으면 파일별 목록을 빼고 표만 남긴다(PR 댓글 한도 65,536자에 여유를 둔 값). */
const MAX_REPORT_LENGTH = 60000;

const STATUS_LABELS = { Survived: '살아남음', NoCoverage: '테스트 안 닿음' };
// 테스트가 있는데도 못 잡은 "살아남음"이 더 볼 만하므로 목록에서 먼저 싣는다(상한에 덜 잘리게).
const STATUS_ORDER = ['Survived', 'NoCoverage'];

function listTargets(baseRevision) {
  // 워킹트리와 비교한다 — CI에서는 PR 머지 커밋이 체크아웃돼 있어 PR의 변경과 같다(dep-graph.js의
  // --affected와 같은 방식).
  const changedFiles = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=d', baseRevision, '--', 'src'],
    { cwd: ROOT, encoding: 'utf8' }
  )
    .split('\n')
    .filter(Boolean);

  const logicFiles = changedFiles.filter(
    (file) => file.endsWith('.ts') && !EXCLUDED_PATTERN.test(file)
  );
  // 테스트만 바꾼 PR(단언을 지운 경우 등)도 그 테스트가 지키는 원본의 점수가 보이게 한다.
  const pairedSources = changedFiles
    .filter((file) => TEST_FILE_PATTERN.test(file))
    .map((file) => file.replace(TEST_FILE_PATTERN, '.ts'))
    .filter((file) => !EXCLUDED_PATTERN.test(file) && fs.existsSync(path.join(ROOT, file)));

  return [...new Set([...logicFiles, ...pairedSources])].sort();
}

function countStatuses(mutants) {
  const counts = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0 };

  for (const mutant of mutants) {
    if (mutant.status in counts) {
      counts[mutant.status] += 1;
    }
  }

  return counts;
}

/** Stryker 기본 점수 중 "테스트가 닿은 코드 기준"과 같은 계산이다. */
function formatCoveredScore({ Killed, Timeout, Survived }) {
  const detected = Killed + Timeout;
  const covered = detected + Survived;

  if (covered === 0) {
    return '-';
  }

  return `${((detected / covered) * 100).toFixed(1)}%`;
}

/** 뮤턴트 위치의 원래 코드. 여러 줄에 걸치면 첫 줄만 보이고 뒤에 …를 붙인다. */
function originalCode(sourceLines, { start, end }) {
  const line = sourceLines[start.line - 1] ?? '';

  if (start.line === end.line) {
    return line.slice(start.column - 1, end.column - 1);
  }

  return `${line.slice(start.column - 1).trimEnd()} …`;
}

function inlineCode(text) {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  const clipped = singleLine.length > 80 ? `${singleLine.slice(0, 79)}…` : singleLine;

  return `\`${clipped.replaceAll('`', "'")}\``;
}

function toFileDetails(file, { source, mutants }) {
  const sourceLines = source.split('\n');
  const remaining = mutants
    .filter((mutant) => mutant.status in STATUS_LABELS)
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        a.location.start.line - b.location.start.line
    );

  if (remaining.length === 0) {
    return '';
  }

  const items = remaining
    .slice(0, MAX_LISTED_MUTANTS)
    .map(
      (mutant) =>
        `- ${mutant.location.start.line}줄 ${STATUS_LABELS[mutant.status]} · ${mutant.mutatorName}: ` +
        `${inlineCode(originalCode(sourceLines, mutant.location))} → ${inlineCode(mutant.replacement ?? '')}`
    );
  const omitted = remaining.length - items.length;

  if (omitted > 0) {
    items.push(`- … 외 ${omitted}개`);
  }

  return `<details><summary><code>${file}</code> — 살아남음·테스트 안 닿음 ${remaining.length}개</summary>\n\n${items.join('\n')}\n\n</details>`;
}

function buildReport(reportPath, targetsPath) {
  const targets = fs.existsSync(targetsPath)
    ? fs.readFileSync(targetsPath, 'utf8').split('\n').filter(Boolean)
    : [];

  if (targets.length === 0) {
    return `${HEADING}\n\n이 PR에는 대상이 없다. 대상은 바뀐 \`src/**/*.ts\` 로직 파일(테스트·스토리·mocks·생성 타입 제외)과, 테스트만 바뀐 경우 같은 폴더의 짝 원본이다.`;
  }

  if (!fs.existsSync(reportPath)) {
    const list = targets.map((file) => `- \`${file}\``).join('\n');
    return `${HEADING}\n\n뮤테이션 테스트가 끝나지 않아 보고서가 없다(실패 또는 시간 초과). job 로그를 확인한다.\n\n대상:\n\n${list}`;
  }

  const { files } = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
  const rows = entries.map(([file, { mutants }]) => {
    const counts = countStatuses(mutants);
    return `| \`${file}\` | ${mutants.length} | ${counts.Killed + counts.Timeout} | ${counts.Survived} | ${counts.NoCoverage} | ${formatCoveredScore(counts)} |`;
  });
  // 상수만 있는 파일(texts.ts 등)은 뮤턴트가 0개라 Stryker 보고서에 아예 없다 — 표에서 빠지지 않게 따로 적는다.
  const withoutMutants = targets.filter((file) => !(file in files));
  rows.push(...withoutMutants.map((file) => `| \`${file}\` | 0 | - | - | - | - |`));
  const details = entries
    .map(([file, result]) => toFileDetails(file, result))
    .filter(Boolean)
    .join('\n\n');

  const sections = [
    HEADING,
    '이 PR이 바꾼 로직 파일(테스트만 바뀌었으면 그 짝 원본)의 코드를 조금씩 바꿔 보고, 테스트가 그 변화를 잡는지 쟀다. ' +
      '**살아남음**은 코드를 바꿔도 테스트가 통과했다는 뜻이고, **테스트 안 닿음**은 그 코드를 실행하는 테스트가 없다는 뜻이다. ' +
      '바꿔도 동작이 같은 등가 뮤턴트도 섞여 있으니 하나씩 보고 판단한다.',
    '| 파일 | 뮤턴트 | 죽음 | 살아남음 | 테스트 안 닿음 | 점수(닿은 것 기준) |\n| --- | --- | --- | --- | --- | --- |\n' +
      rows.join('\n'),
    details,
    `로컬 재현: \`pnpm test:mutation --mutate ${targets.join(',')}\``,
  ];
  const report = sections.filter(Boolean).join('\n\n');

  if (report.length <= MAX_REPORT_LENGTH) {
    return report;
  }

  sections[3] =
    '파일별 목록은 PR 댓글 길이 한도를 넘어 뺐다. 아래 로컬 재현 명령이나 job 로그로 본다.';
  return sections.join('\n\n');
}

function main() {
  const [mode, ...args] = process.argv.slice(2);

  if (mode === '--targets' && args[0]) {
    const targets = listTargets(args[0]);

    if (targets.length > 0) {
      console.log(targets.join('\n'));
    }

    return;
  }

  if (mode === '--report' && args[0] && args[1]) {
    console.log(buildReport(args[0], args[1]));
    return;
  }

  console.error('사용법: node scripts/mutation-report.js --targets <기준 커밋>');
  console.error(
    '        node scripts/mutation-report.js --report <mutation.json> <대상 목록 파일>'
  );
  process.exit(1);
}

main();
