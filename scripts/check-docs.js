// 문서(README.md, docs/*.md, .claude/CLAUDE.md)가 가리키는 파일 경로·줄 번호가
// 실제 코드와 아직 맞는지 검사한다. 2026-09-07, 문서 구조 감사에서 TESTING.md가
// 폐기된 src/domains/ 레이어를 한 달 넘게 정본처럼 서술하고 있던 걸 발견한 뒤
// 만들었다 — 그 문제는 사람이 수시로 다시 읽지 않는 한 절대 스스로 안 잡힌다.
//
// 정직한 한계: 이 스크립트는 "그 경로가 존재하는가"·"그 줄 번호가 파일 범위
// 안인가"만 본다. "그 줄에 실제로 그 내용이 있는가"는 검사하지 못한다 — 그래서
// 자주 바뀌는 파일(예: eslint.config.js)은 애초에 줄 번호로 인용하지 않는 쪽이
// 정공법이다(문서 안에서 그렇게 하고 있다).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TARGET_FILES = [
  'README.md',
  '.claude/CLAUDE.md',
  ...fs
    .readdirSync(path.join(ROOT, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`),
];

const STALE_REVIEW_DAYS = 30;

// 문서 안에서 "이 경로는 아직 없는 게 정상"이라고 표시하는 마커.
// 코드 펜스 바로 앞 줄(빈 줄 포함 2줄 이내)에 있으면 그 펜스 전체를 건너뛴다.
const IGNORE_MARKER = '<!-- check-docs-ignore';

// BE 레포 경로 등, 이 레포 기준으로는 원래 존재하지 않는 걸로 정상인 접두사.
const KNOWN_EXTERNAL_PREFIXES = ['src/main/kotlin/'];

let errorCount = 0;
let warningCount = 0;

function reportError(file, line, message) {
  errorCount += 1;
  console.error(`✗ ${file}:${line}  ${message}`);
}

function reportWarning(file, line, message) {
  warningCount += 1;
  console.warn(`⚠ ${file}:${line}  ${message}`);
}

/** 파일을 줄 배열로 읽되, 각 줄이 "무시된 코드 펜스 안"인지 표시한 배열도 함께 준다. */
function readLinesWithIgnoreZones(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const lines = raw.split('\n');
  const ignored = new Array(lines.length).fill(false);

  let pendingIgnore = false;
  let inFence = false;
  let fenceIsIgnored = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.includes(IGNORE_MARKER)) {
      pendingIgnore = true;
      continue;
    }

    const isFenceLine = /^\s*```/.test(line);

    if (isFenceLine && !inFence) {
      inFence = true;
      fenceIsIgnored = pendingIgnore;
      pendingIgnore = false;
      ignored[i] = fenceIsIgnored;
      continue;
    }

    if (isFenceLine && inFence) {
      ignored[i] = fenceIsIgnored;
      inFence = false;
      fenceIsIgnored = false;
      continue;
    }

    if (inFence) {
      ignored[i] = fenceIsIgnored;
    } else if (!/^\s*$/.test(line)) {
      // 코드 펜스 밖의 실질적인 줄이 나오면 마커 유효기간이 끝난다
      // (마커는 바로 다음에 오는 펜스 하나만 겨냥한다).
      pendingIgnore = false;
    }
  }

  return { lines, ignored };
}

// src/**, .github/**, infra/** 아래 파일 하나를 가리키는 것으로 보이는 토큰.
// 확장자가 있는 경로만 대상으로 한다 — 확장자 없는 디렉터리 경로(`src/entities/post/`)는
// grep 정확도가 떨어져 오탐이 크므로 제외한다.
const PATH_TOKEN_RE = /\b(src|\.github|infra)\/[A-Za-z0-9/_.-]*\.[A-Za-z0-9]+\b/g;

function checkPathsExist(file, absPath, lines, ignored) {
  lines.forEach((line, idx) => {
    if (ignored[idx]) {
      return;
    }

    const matches = line.match(PATH_TOKEN_RE);

    if (!matches) {
      return;
    }

    for (const rawMatch of matches) {
      // 트리 그림의 마지막 문자(쉼표, 괄호 등)가 붙어 들어오는 경우를 정리
      const match = rawMatch.replace(/[),.]+$/, '');

      if (KNOWN_EXTERNAL_PREFIXES.some((prefix) => match.startsWith(prefix))) {
        continue;
      }

      const targetAbs = path.join(ROOT, match);

      if (!fs.existsSync(targetAbs)) {
        reportError(file, idx + 1, `존재하지 않는 경로: ${match}`);
      }
    }
  });
}

// `path:line` 또는 `path:line-line` 형태. 백틱 유무 둘 다 허용.
// 경로에 슬래시가 있거나(디렉터리 포함) 알려진 루트 설정 파일일 때만 검사한다 —
// `useRecentFolders.ts:6`처럼 디렉터리 없는 파일명은 레포에 동명 파일이 여러 개
// 있을 수 있어 이 스크립트가 신뢰성 있게 찾을 수 없다(정직한 한계).
const ROOT_CONFIG_FILES = new Set([
  'package.json',
  'eslint.config.js',
  '.prettierignore',
  'vite.config.ts',
  'tsconfig.app.json',
]);

const LINE_REF_RE = /`?([A-Za-z0-9_./-]+\.[A-Za-z]+):(\d+)(?:-(\d+))?`?/g;

function checkLineRefsInBounds(file, lines, ignored) {
  lines.forEach((line, idx) => {
    if (ignored[idx]) {
      return;
    }

    let match = LINE_REF_RE.exec(line);

    while (match !== null) {
      const [, refPath, startStr, endStr] = match;
      const hasDir = refPath.includes('/');

      if (hasDir || ROOT_CONFIG_FILES.has(refPath)) {
        const targetAbs = path.join(ROOT, refPath);

        if (fs.existsSync(targetAbs)) {
          const totalLines = fs.readFileSync(targetAbs, 'utf8').split('\n').length;
          const start = Number(startStr);
          const end = endStr ? Number(endStr) : start;

          if (start > totalLines || end > totalLines) {
            reportError(
              file,
              idx + 1,
              `${refPath}:${startStr}${endStr ? `-${endStr}` : ''} — 파일은 ${totalLines}줄뿐`
            );
          }
        }
      }

      match = LINE_REF_RE.exec(line);
    }
  });
}

function checkReadmeDocsSync() {
  const readmePath = path.join(ROOT, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  const docsSectionMatch = readme.match(/## 문서\n([\s\S]*?)(\n## |\n$)/);

  if (!docsSectionMatch) {
    reportError('README.md', 1, '"## 문서" 섹션을 찾을 수 없음');
    return;
  }

  const section = docsSectionMatch[1];
  const referenced = new Set(
    Array.from(section.matchAll(/docs\/([A-Za-z0-9-]+\.md)/g)).map((m) => m[1])
  );

  const actual = new Set(fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')));

  for (const f of actual) {
    if (!referenced.has(f)) {
      reportError('README.md', 1, `docs/${f}가 "## 문서" 섹션에 등록되지 않음`);
    }
  }

  for (const f of referenced) {
    if (!actual.has(f)) {
      reportError('README.md', 1, `"## 문서" 섹션이 가리키는 docs/${f}가 실존하지 않음`);
    }
  }
}

function checkLastReviewedFreshness(file, content) {
  const match = content.match(/\*\*마지막 검토\*\*:\s*(\d{4}-\d{2}-\d{2})/);

  if (!match) {
    return;
  }

  const reviewed = new Date(match[1]);
  const ageDays = Math.floor((Date.now() - reviewed.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays > STALE_REVIEW_DAYS) {
    reportWarning(
      file,
      1,
      `마지막 검토가 ${ageDays}일 전(${match[1]}) — 구조가 그새 바뀌지 않았는지 확인 권장`
    );
  }
}

function main() {
  for (const relPath of TARGET_FILES) {
    const absPath = path.join(ROOT, relPath);
    const { lines, ignored } = readLinesWithIgnoreZones(absPath);

    checkPathsExist(relPath, absPath, lines, ignored);
    checkLineRefsInBounds(relPath, lines, ignored);
    checkLastReviewedFreshness(relPath, lines.join('\n'));
  }

  checkReadmeDocsSync();

  if (warningCount > 0) {
    console.warn(`\n${warningCount}개 경고 (통과에는 영향 없음)`);
  }

  if (errorCount > 0) {
    console.error(`\n${errorCount}개 오류 — 문서가 가리키는 경로/줄 번호를 실제와 맞춰주세요.`);
    process.exit(1);
  }

  console.log('문서-코드 참조 검사 통과.');
}

main();
