// PR 본문에 필수 절이 있고 템플릿 안내문 그대로가 아닌지 본다(scripts/check-pr-body.js가 쓴다).
// 절의 내용이 의도대로인지는 판단하지 않는다 - 그건 병합을 승인하는 사람이 본다(docs/PR-BODY-CHECK.md §5).
// 실제 실행과 분리해 두어 판정 규칙만 단위 테스트로 고정한다(src/test/scripts/pr-body.test.ts).

/**
 * 필수 절. names 중 하나로 시작하는 `## ` 제목이 있으면 그 절로 본다 - plan mode를 거친 작업은
 * "의도 대비 결과" 대신 "계획 대비 구현"을 쓴다(.claude/CLAUDE.md §11).
 */
export const REQUIRED_SECTIONS = [
  { names: ['요약'], hint: '무엇을 왜 바꿨는지' },
  { names: ['영향 범위'], hint: '이 변경이 닿는 사용처' },
  {
    names: ['의도 대비 결과', '계획 대비 구현'],
    hint: '원래 요청·의도와 항목별 결과·증거·판정',
  },
  { names: ['검증'], hint: '실행한 명령과 결과, CI run 링크 등' },
];

const HEADING = /^(#{1,2}) (.+)$/;
const FENCE = /^\s*(```|~~~)/;
// 표 구분선·빈 목록(-, - [ ])처럼 글자 없이 기호만 있는 줄
const SYMBOLS_ONLY = /^[\s|:\-[\]]*$/;

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * `## 제목`별로 내용 줄을 모은다. 코드 블록 안의 `# `·`## `(셸 주석 등)는 제목으로 보지 않는다.
 * `# ` 제목도 절의 끝으로 본다.
 */
function collectSections(body) {
  const sections = [];
  let current = null;
  let inFence = false;

  for (const line of stripComments(body).split(/\r?\n/)) {
    if (FENCE.test(line)) {
      inFence = !inFence;
    }

    const heading = inFence ? null : HEADING.exec(line);

    if (heading) {
      current = heading[1] === '##' ? { title: heading[2].trim(), lines: [] } : null;

      if (current) {
        sections.push(current);
      }

      continue;
    }

    current?.lines.push(line);
  }

  return sections;
}

/** "## 검증 (로컬)"처럼 이름 뒤에 덧붙인 제목도 그 절로 본다 */
function matchesName(title, name) {
  return title === name || title.startsWith(`${name} `) || title.startsWith(`${name}(`);
}

/**
 * 템플릿에 있는 줄(안내문·표 머리글 등)과 기호만 있는 줄을 빼고도 남는 줄이 있으면 내용이 있다고 본다.
 *
 * @param {string[]} lines
 * @param {Set<string>} templateLines
 */
function hasContent(lines, templateLines) {
  return lines
    .map((line) => line.trim())
    .some((line) => !SYMBOLS_ONLY.test(line) && !templateLines.has(line));
}

/**
 * 빠졌거나 비어 있는 필수 절마다 안내 문구를 하나씩 돌려준다. 빈 배열이면 통과다.
 *
 * @param {string | null | undefined} body PR 본문
 * @param {string} template `.github/pull_request_template.md` 내용
 * @returns {string[]}
 */
export function findPrBodyProblems(body, template) {
  const sections = collectSections(body ?? '');
  const templateLines = new Set(
    stripComments(template)
      .split(/\r?\n/)
      .map((line) => line.trim())
  );

  return REQUIRED_SECTIONS.flatMap(({ names, hint }) => {
    const label = names.map((name) => `"## ${name}"`).join(' 또는 ');
    const matched = sections.filter(({ title }) => names.some((name) => matchesName(title, name)));

    if (matched.length === 0) {
      return [`${label} 절이 없습니다 — ${hint}`];
    }

    if (!matched.some(({ lines }) => hasContent(lines, templateLines))) {
      return [`${label} 절이 비어 있거나 템플릿 안내문 그대로입니다 — ${hint}`];
    }

    return [];
  });
}
