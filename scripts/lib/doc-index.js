// docs/DECISIONS.md와 docs/plans/*.md에서 색인(docs/DECISIONS-INDEX.md, docs/PLANS-INDEX.md)의 내용을 만든다
// (scripts/generate-doc-index.js가 쓴다). 원본 문서는 읽기만 한다 - 과거 결정 항목과 커밋된 계획은 고치지 않는
// 문서라, 주제 분류도 원본이 아니라 scripts/lib/decision-topics.json에 둔다.
// 파일 읽기·쓰기와 분리해 두어 판정 규칙만 단위 테스트로 고정한다(src/test/scripts/doc-index.test.ts).

const DECISION_HEADING = /^## (\d{4}-\d{2}-\d{2}) — (.+)$/;
const STATUS_LINE = /^\*\*상태\*\*:?\s*(.*)$/;
const STATUS_MAX_LENGTH = 20;
const PLAN_FILE = /^(\d{4}-\d{2}-\d{2})-.+\.md$/;
const RESULT_START = /^<!-- plan-result:start/;
const RESULT_END = /^<!-- plan-result:end -->/;

/**
 * GitHub가 헤딩에 붙이는 앵커. 소문자로 바꾸고 글자·숫자·밑줄·하이픈·공백만 남긴 뒤 공백을 하이픈으로 바꾼다.
 * 같은 값이 또 나오면 `-1`, `-2`를 붙인다(seen에 센다). 백틱은 지워지고 안의 글자는 남는다.
 */
export function toHeadingAnchor(heading, seen) {
  const base = heading
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
  const count = seen.get(base) ?? 0;

  seen.set(base, count + 1);

  return count === 0 ? base : `${base}-${count}`;
}

/** `**상태**` 문단의 첫 구절만 뽑는다. 괄호·마침표·쉼표·쌍점 앞에서 끊고 길면 자른다. */
function toShortStatus(text) {
  const head = text.split(/[(.,:—]/)[0].trim();

  return head.length > STATUS_MAX_LENGTH ? `${head.slice(0, STATUS_MAX_LENGTH)}…` : head;
}

/**
 * DECISIONS.md를 항목 목록으로 바꾼다. 항목은 `## YYYY-MM-DD — 제목` 헤딩에서 다음 헤딩 전까지다.
 * status는 그 안의 `**상태**` 문단 첫 구절이고, 없으면 빈 문자열이다.
 */
export function parseDecisions(markdown) {
  const entries = [];
  const seen = new Map();
  let current = null;
  let awaitingStatus = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      const match = line.match(DECISION_HEADING);

      current = null;
      awaitingStatus = false;

      // 앵커 번호는 문서의 모든 ## 헤딩을 세어야 GitHub와 맞는다
      const anchor = toHeadingAnchor(line.slice(3), seen);

      if (match) {
        current = { date: match[1], title: match[2], key: line.slice(3), anchor, status: '' };
        entries.push(current);
      }

      continue;
    }

    if (!current || current.status) {
      continue;
    }

    const statusMatch = line.match(STATUS_LINE);

    if (statusMatch) {
      current.status = toShortStatus(statusMatch[1]);
      awaitingStatus = !current.status;
      continue;
    }

    if (awaitingStatus && line.trim()) {
      current.status = toShortStatus(line.trim());
      awaitingStatus = false;
    }
  }

  return entries;
}

/** 분류표(항목 키 → 주제)에 없는 항목의 키를 돌려준다. 색인을 만들기 전에 이것이 비어 있어야 한다. */
export function findUnclassified(entries, topics) {
  return entries.filter((entry) => !topics[entry.key]).map((entry) => entry.key);
}

function escapeCell(text) {
  return text.replace(/\|/g, '\\|');
}

function decisionRow(entry) {
  return `| ${entry.date} | [${escapeCell(entry.title)}](./DECISIONS.md#${entry.anchor}) | ${escapeCell(entry.status)} |`;
}

/** 주제별 표(분류표에 처음 나온 주제 순서)와 날짜순 표(최신 날짜부터)를 만든다. */
export function renderDecisionIndex(entries, topics) {
  const topicOrder = [...new Set(Object.values(topics))];
  const lines = [
    '# 설계 결정 색인',
    '',
    '> `pnpm docs:index`가 [`DECISIONS.md`](./DECISIONS.md)에서 만든 파일이다. 직접 고치지 않는다.',
    '> 주제 분류는 `scripts/lib/decision-topics.json`에 있다.',
    '',
    `항목 ${entries.length}개. 주제별로 먼저, 그 아래 날짜순으로 싣는다.`,
    '',
    '## 주제별',
  ];

  for (const topic of topicOrder) {
    const rows = entries.filter((entry) => topics[entry.key] === topic);

    if (rows.length === 0) {
      continue;
    }

    lines.push(
      '',
      `### ${topic} (${rows.length})`,
      '',
      '| 날짜 | 결정 | 상태 |',
      '| --- | --- | --- |'
    );
    lines.push(...rows.map(decisionRow));
  }

  lines.push('', '## 날짜순', '', '| 날짜 | 결정 | 상태 |', '| --- | --- | --- |');
  // 원본은 최신이 위지만 순서가 어긋난 항목이 있어 날짜로 다시 정렬한다(같은 날짜는 원본 순서 유지)
  const byDate = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  lines.push(...byDate.map(decisionRow), '');

  return lines.join('\n');
}

/**
 * 계획 파일 하나를 색인 행으로 바꾼다. 이름이 `YYYY-MM-DD-슬러그.md`가 아니면 null이다.
 * 구현 결과 블록이 있으면 요약 줄(`> #PR · 날짜 대조 · 이탈 N · 미구현 N`)에서 PR 번호와 건수를 읽는다.
 * 요약 줄이 여러 개면 PR을 모으고 건수를 더한다. 블록이 없거나 요약 줄이 없으면 result는 null이다.
 */
export function parsePlan(fileName, markdown) {
  const nameMatch = fileName.match(PLAN_FILE);

  if (!nameMatch) {
    return null;
  }

  const lines = markdown.split(/\r?\n/);
  const heading = lines.find((line) => line.startsWith('# '));
  const prs = [];
  let deviations = 0;
  let missing = 0;
  let hasSummary = false;
  let superseded = '';
  let inResult = false;

  for (const line of lines) {
    if (RESULT_START.test(line)) {
      inResult = true;
      continue;
    }

    if (RESULT_END.test(line)) {
      break;
    }

    if (!inResult) {
      continue;
    }

    const summary = line.match(/^> (.*?) · \d{4}-\d{2}-\d{2} 대조 · .*이탈 (\d+) · 미구현 (\d+)/);

    if (summary) {
      hasSummary = true;
      prs.push(...(summary[1].match(/#\d+/g) ?? []));
      deviations += Number(summary[2]);
      missing += Number(summary[3]);
      continue;
    }

    const supersededMatch = line.match(/^- (대체됨(?:\(일부\))?):/);

    if (supersededMatch && !superseded) {
      superseded = supersededMatch[1];
    }
  }

  return {
    fileName,
    date: nameMatch[1],
    title: heading ? heading.slice(2).trim() : fileName,
    result: hasSummary ? { prs: [...new Set(prs)], deviations, missing } : null,
    superseded,
  };
}

function planRow(plan) {
  const result = plan.result
    ? `${plan.result.prs.join(' ')} · 이탈 ${plan.result.deviations} · 미구현 ${plan.result.missing}`
    : '';

  return `| ${plan.date} | [${escapeCell(plan.title)}](./plans/${plan.fileName}) | ${result} | ${plan.superseded} |`;
}

/** 월별 표를 최신 달부터 만든다. 달 안에서는 최신 날짜부터, 같은 날짜는 파일 이름순이다. */
export function renderPlanIndex(plans) {
  const sorted = [...plans].sort(
    (a, b) => b.date.localeCompare(a.date) || a.fileName.localeCompare(b.fileName)
  );
  const months = [...new Set(sorted.map((plan) => plan.date.slice(0, 7)))];
  const lines = [
    '# 작업 계획 색인',
    '',
    '> `pnpm docs:index`가 [`docs/plans/`](./plans/)에서 만든 파일이다. 직접 고치지 않는다.',
    '',
    `계획 ${plans.length}개. "대조"는 계획 파일의 구현 결과 블록에서 읽은 PR 번호와 이탈·미구현 건수다.`,
    '블록 규칙(2026-11-03) 전의 계획은 비어 있다.',
  ];

  for (const month of months) {
    const rows = sorted.filter((plan) => plan.date.startsWith(month));

    lines.push(
      '',
      `## ${month} (${rows.length})`,
      '',
      '| 날짜 | 계획 | 대조 | 대체 |',
      '| --- | --- | --- | --- |'
    );
    lines.push(...rows.map(planRow));
  }

  lines.push('');

  return lines.join('\n');
}
