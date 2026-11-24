// 확인 이슈(라벨 manual-check)의 본문 형식과 답 댓글을 판정한다(scripts/check-manual-issue.js가 쓴다).
// 답의 내용이 사실인지는 판정하지 않는다 - 단계마다 답이 있는지, 적은 빌드가 확인할 변경을 포함하는지만 본다
// (docs/MANUAL-CHECK.md §5). 실제 실행(git·GitHub API)과 분리해 두어 판정 규칙만 단위 테스트로 고정한다
// (src/test/scripts/manual-check.test.ts).

export const LABEL = 'manual-check';
/** 검사가 갱신하는 상태 댓글을 찾는 표식. 이 표식이 든 댓글은 답으로 세지 않는다. */
export const STATUS_MARKER = '<!-- manual-check-status -->';
/** 본 것의 최소 글자 수(공백 제외). 얕은 검사다 - 내용이 맞는지는 보지 않는다(docs/MANUAL-CHECK.md §5.4·§7). */
export const MIN_OBSERVATION_LENGTH = 5;

export const REQUIRED_SECTIONS = [
  { name: '무엇을 확인하나', hint: '어떤 변경을 어느 기기에서 보는지' },
  { name: '왜 사람이 봐야 하나', hint: '자동 테스트로 볼 수 없는 이유' },
  { name: '확인 항목', hint: '"확인할 빌드:" 줄과 번호 붙은 단계' },
  { name: '결과에 따라', hint: '기대와 다르면 무엇부터 볼지' },
];

const STEPS_SECTION = '확인 항목';
const VERDICTS = ['통과', '실패'];

const HEADING = /^(#{1,2}) (.+)$/;
const FENCE = /^\s*(```|~~~)/;
// 표 구분선·빈 목록처럼 글자 없이 기호만 있는 줄
const SYMBOLS_ONLY = /^[\s|:\-[\]]*$/;
const REQUIRED_BUILD = /^확인할 빌드\s*:\s*(?:(없음)|`?([0-9a-fA-F]{7,40})`?(?:\s*이후)?)\s*$/;
const STEP = /^(\d+)\.\s+(.+)$/;
const EXPECTATION = /^\s+[-*]\s*기대\s*:\s*(.*)$/;
const TO_RECORD = /^\s+[-*]\s*적을 것\s*:\s*(.*)$/;
const BUILD_LINE = /^\s*빌드\s*:\s*`?([0-9a-fA-F]{7,40})`?\s*$/;
const NUMBERED_LINE = /^\s*(\d+)\s*[.)]\s*(.*)$/;
// 폰 자판에서는 긴 줄표를 치기 어려워 하이픈·콜론도 받고, 구분 기호가 없어도 받는다
const VERDICT_AND_OBSERVATION = new RegExp(`^(${VERDICTS.join('|')})\\s*[—–\\-:]*\\s*(.*)$`);

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

/** `## 제목`별로 내용 줄을 모은다. 코드 블록 안의 `#` 줄은 제목으로 보지 않고, `# ` 제목도 절의 끝으로 본다. */
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

/** "## 확인 항목 (Android)"처럼 이름 뒤에 덧붙인 제목도 그 절로 본다 */
function matchesName(title, name) {
  return title === name || title.startsWith(`${name} `) || title.startsWith(`${name}(`);
}

function hasContent(lines) {
  return lines.some((line) => !SYMBOLS_ONLY.test(line));
}

/**
 * "확인 항목" 절에서 확인할 빌드와 단계를 뽑는다.
 *
 * @param {string[]} lines
 */
function parseStepsSection(lines) {
  const steps = [];
  let requiredBuild = null;
  let hasBuildLine = false;
  let inFence = false;

  for (const line of lines) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const build = REQUIRED_BUILD.exec(line.trim());

    if (build) {
      hasBuildLine = true;
      requiredBuild = build[1] ? null : build[2].toLowerCase();
      continue;
    }

    const step = STEP.exec(line);

    if (step) {
      steps.push({
        number: Number(step[1]),
        action: step[2].trim(),
        expectation: '',
        toRecord: '',
      });
      continue;
    }

    const last = steps.at(-1);

    if (!last) {
      continue;
    }

    const expectation = EXPECTATION.exec(line);

    if (expectation) {
      last.expectation = expectation[1].trim();
      continue;
    }

    const toRecord = TO_RECORD.exec(line);

    if (toRecord) {
      last.toRecord = toRecord[1].trim();
    }
  }

  return { steps, requiredBuild, hasBuildLine };
}

function findStepProblems({ steps, hasBuildLine }) {
  const problems = [];

  if (!hasBuildLine) {
    problems.push(
      '"확인할 빌드:" 줄이 없습니다 — "확인할 빌드: <커밋 7자리 이상> 이후" 또는 "확인할 빌드: 없음"'
    );
  }

  if (steps.length === 0) {
    problems.push('번호 붙은 단계가 없습니다 — "1. <하는 일>"로 시작하는 줄을 둡니다');

    return problems;
  }

  if (steps.some((step, index) => step.number !== index + 1)) {
    problems.push(
      `단계 번호는 1부터 차례로 붙입니다 — 지금은 ${steps.map((step) => step.number).join(', ')}`
    );
  }

  for (const step of steps) {
    if (!step.expectation) {
      problems.push(
        `${step.number}번 단계에 "기대:"가 없습니다 — 단계 아래에 "   - 기대: <기대하는 모습>"`
      );
    }

    if (!step.toRecord) {
      problems.push(
        `${step.number}번 단계에 "적을 것:"이 없습니다 — 단계 아래에 "   - 적을 것: <해 봐야 알 수 있는 것>"`
      );
    }
  }

  return problems;
}

/**
 * 확인 이슈 본문을 읽어 형식 오류, 확인할 빌드, 단계를 돌려준다. problems가 빈 배열이면 형식이 맞다.
 * requiredBuild가 null이면 빌드를 요구하지 않는 이슈다("확인할 빌드: 없음").
 *
 * @param {string | null | undefined} body
 */
export function parseIssueBody(body) {
  const sections = collectSections(body ?? '');
  const problems = [];
  let parsed = { steps: [], requiredBuild: null, hasBuildLine: false };

  for (const { name, hint } of REQUIRED_SECTIONS) {
    const matched = sections.filter(({ title }) => matchesName(title, name));

    if (matched.length === 0) {
      problems.push(`"## ${name}" 절이 없습니다 — ${hint}`);
      continue;
    }

    const lines = matched.flatMap((section) => section.lines);

    if (!hasContent(lines)) {
      problems.push(`"## ${name}" 절이 비어 있습니다 — ${hint}`);
      continue;
    }

    if (name === STEPS_SECTION) {
      parsed = parseStepsSection(lines);
      problems.push(...findStepProblems(parsed));
    }
  }

  return { problems, requiredBuild: parsed.requiredBuild, steps: parsed.steps };
}

function isAnswerCandidate(comment) {
  return (
    comment.authorAssociation === 'OWNER' &&
    comment.userType !== 'Bot' &&
    typeof comment.body === 'string' &&
    !comment.body.includes(STATUS_MARKER)
  );
}

/** 댓글 하나에서 빌드 줄과 번호 붙은 줄을 뽑는다 */
function readAnswerComment(text) {
  let build = null;
  const lines = [];

  for (const line of text.split(/\r?\n/)) {
    const buildLine = BUILD_LINE.exec(line);

    if (buildLine) {
      build = build ?? buildLine[1].toLowerCase();
      continue;
    }

    const numbered = NUMBERED_LINE.exec(line);

    if (numbered) {
      const verdict = VERDICT_AND_OBSERVATION.exec(numbered[2].trim());

      lines.push({
        number: Number(numbered[1]),
        verdict: verdict ? verdict[1] : null,
        observation: verdict ? verdict[2].trim() : '',
      });
    }
  }

  return { build, lines };
}

/**
 * 이슈 본문과 댓글로 지금 상태를 판정한다.
 *
 * - 답으로 세는 것은 저장소 주인(OWNER)이 쓴 댓글뿐이다(공개 저장소라 누구나 댓글을 달 수 있다).
 * - 같은 단계에 답이 여럿이면 가장 늦은 답을 센다. 세지 않는 답은 앞선 답을 덮지 않는다.
 * - checkBuild(적은 빌드, 확인할 빌드)는 문제가 없으면 null, 있으면 이유 문장을 돌려준다.
 * - checkRequiredBuild(확인할 빌드)도 같다. 확인할 빌드가 틀리면 어떤 답도 셀 수 없으므로, 답이 오기를 기다리지 않고
 *   본문 형식 오류로 알린다.
 *
 * @param {{ body: string | null | undefined, comments: { body: string | null, url: string, authorAssociation: string, userType: string }[], checkBuild: (typed: string, required: string) => string | null, checkRequiredBuild?: (required: string) => string | null }} input
 */
export function evaluateIssue({ body, comments, checkBuild, checkRequiredBuild }) {
  const parsed = parseIssueBody(body);
  const { requiredBuild, steps } = parsed;
  const requiredBuildProblem =
    requiredBuild && checkRequiredBuild ? checkRequiredBuild(requiredBuild) : null;
  const bodyProblems = requiredBuildProblem
    ? [...parsed.problems, requiredBuildProblem]
    : parsed.problems;
  const stepNumbers = steps.map((step) => step.number);

  if (bodyProblems.length > 0) {
    return {
      status: 'malformed',
      bodyProblems,
      steps,
      requiredBuild,
      answers: steps.map(() => null),
      rejected: [],
      missing: stepNumbers,
      failed: [],
    };
  }

  const counted = new Map();
  const rejected = [];

  for (const comment of comments.filter(isAnswerCandidate)) {
    const { build, lines } = readAnswerComment(comment.body);

    // 빌드 줄도 판정 줄도 없는 댓글은 답하려던 것이 아니다(메모·질문)
    if (!build && !lines.some((line) => line.verdict)) {
      continue;
    }

    if (lines.length === 0) {
      continue;
    }

    if (requiredBuild && !build) {
      rejected.push({
        url: comment.url,
        reason:
          '"빌드:" 줄이 없습니다 — 버전 화면(/version)의 "이 탭이 실행 중인 빌드" 7자리를 "빌드: <값>"으로 적어 주세요',
      });
      continue;
    }

    const buildProblem = requiredBuild ? checkBuild(build, requiredBuild) : null;

    if (buildProblem) {
      rejected.push({ url: comment.url, reason: `빌드 ${build}: ${buildProblem}` });
      continue;
    }

    for (const line of lines) {
      if (!stepNumbers.includes(line.number)) {
        rejected.push({
          url: comment.url,
          reason: `${line.number}번: 본문에 없는 단계 번호입니다`,
        });
        continue;
      }

      if (!line.verdict) {
        rejected.push({
          url: comment.url,
          reason: `${line.number}번: 판정은 "통과"나 "실패"로 적어 주세요`,
        });
        continue;
      }

      if (line.observation.replace(/\s/g, '').length < MIN_OBSERVATION_LENGTH) {
        rejected.push({
          url: comment.url,
          reason: `${line.number}번: 본 것을 ${MIN_OBSERVATION_LENGTH}자 이상 적어 주세요`,
        });
        continue;
      }

      counted.set(line.number, {
        number: line.number,
        verdict: line.verdict,
        observation: line.observation,
        build: requiredBuild ? build : null,
        url: comment.url,
      });
    }
  }

  const answers = stepNumbers.map((number) => counted.get(number) ?? null);
  const missing = stepNumbers.filter((number) => !counted.has(number));
  const failed = stepNumbers.filter((number) => counted.get(number)?.verdict === '실패');
  let status = 'passed';

  if (missing.length > 0) {
    status = 'incomplete';
  } else if (failed.length > 0) {
    status = 'failed';
  }

  return { status, bodyProblems, steps, requiredBuild, answers, rejected, missing, failed };
}

/**
 * 판정과 이벤트로 워크플로가 할 일을 정한다.
 *
 * - 모두 통과가 아닌 채 닫혀 있으면 다시 연다(닫은 사유는 보지 않는다).
 * - 모두 통과면 닫되 댓글 이벤트에서만 닫는다 - 사용자가 다시 확인하려고 연 이슈를 곧바로 닫지 않는다.
 * - 라벨이 떼어졌으면 그 사실만 댓글로 남긴다.
 *
 * @param {{ status: string }} evaluation
 * @param {{ name: string, action: string, state: string, labelRemoved: boolean }} event
 */
export function decideActions(evaluation, event) {
  if (event.labelRemoved) {
    return { reopen: false, close: false, noteUnlabeled: true, updateStatus: false };
  }

  const passed = evaluation.status === 'passed';

  return {
    reopen: !passed && event.state === 'closed',
    close: passed && event.state === 'open' && event.name === 'issue_comment',
    noteUnlabeled: false,
    updateStatus: true,
  };
}

function countAnswers(evaluation) {
  const answered = evaluation.answers.filter(Boolean);

  return {
    answered: answered.length,
    total: evaluation.steps.length,
    passed: answered.filter((answer) => answer.verdict === '통과').length,
    failed: answered.filter((answer) => answer.verdict === '실패').length,
  };
}

/** 표 칸을 깨는 글자를 이스케이프한다 */
function tableCell(text) {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

const REOPEN_REASON = {
  malformed: '본문 형식이 맞지 않은 채',
  incomplete: '답이 빠진 단계가 있는 채',
  failed: '실패한 단계가 있는 채',
};

function headline(evaluation, actions) {
  if (actions.reopen) {
    return `${REOPEN_REASON[evaluation.status]} 닫혀 **다시 열었습니다.** 모든 단계가 통과로 답해지면 검사가 닫습니다.`;
  }

  if (actions.close) {
    return '**모든 단계가 통과**로 답해져 이슈를 닫습니다.';
  }

  if (evaluation.status === 'passed') {
    return '**모든 단계가 통과**로 답해져 있습니다.';
  }

  if (evaluation.status === 'failed') {
    return '**실패한 단계가 있어 열어 둡니다.** 고친 뒤 그 단계를 다시 답하면 늦은 답으로 다시 판정합니다.';
  }

  return null;
}

const DOCS_PATH = 'docs/MANUAL-CHECK.md';

/** 상태 댓글 꼬리말. 문서 주소는 절대 주소로 받는다 - 댓글 안의 상대 링크는 폰 앱·메일 알림에서 열리지 않는다 */
function howToAnswer(docsUrl) {
  const docs = docsUrl ? `[${DOCS_PATH}](${docsUrl})` : DOCS_PATH;

  return [
    '---',
    '답하는 법: 이 이슈에 댓글로 적습니다.',
    '',
    '```',
    '빌드: <버전 화면(/version)의 "이 탭이 실행 중인 빌드" 7자리>',
    '1. 통과 — <본 것>',
    '2. 실패 — <본 것>',
    '```',
    '',
    `판정은 \`통과\`나 \`실패\`, 본 것은 ${MIN_OBSERVATION_LENGTH}자 이상입니다. 본문에 "확인할 빌드: 없음"이면 빌드 줄은 없어도 됩니다. 이 댓글은 검사가 갱신합니다(${docs}).`,
  ];
}

/**
 * 검사가 하나만 두고 갱신하는 상태 댓글 본문.
 *
 * @param {ReturnType<typeof evaluateIssue>} evaluation
 * @param {ReturnType<typeof decideActions>} actions
 * @param {string} [docsUrl] docs/MANUAL-CHECK.md의 절대 주소. 없으면 문서 경로만 글자로 적는다
 */
export function renderStatusComment(evaluation, actions, docsUrl) {
  const lines = [STATUS_MARKER, '## 확인 이슈 상태', ''];
  const head = headline(evaluation, actions);

  if (head) {
    lines.push(head, '');
  }

  if (evaluation.status === 'malformed') {
    lines.push(
      '**본문 형식을 고쳐야 검사할 수 있습니다.**',
      '',
      ...evaluation.bodyProblems.map((problem) => `- ${problem}`),
      ''
    );
  } else {
    const count = countAnswers(evaluation);
    const remaining =
      evaluation.missing.length > 0 ? ` — 남은 단계: ${evaluation.missing.join(', ')}` : '';

    lines.push(
      `**답 ${count.answered}/${count.total} · 통과 ${count.passed} · 실패 ${count.failed}**${remaining}`,
      '',
      '| 단계 | 판정 | 본 것 | 빌드 | 답 |',
      '| --- | --- | --- | --- | --- |',
      ...evaluation.steps.map((step, index) => {
        const answer = evaluation.answers[index];

        if (!answer) {
          return `| ${step.number} | — | | | |`;
        }

        const build = answer.build ? `\`${answer.build}\`` : '—';

        return `| ${step.number} | ${answer.verdict} | ${tableCell(answer.observation)} | ${build} | [댓글](${answer.url}) |`;
      }),
      ''
    );
  }

  if (evaluation.rejected.length > 0) {
    lines.push(
      '세지 않은 답',
      '',
      ...evaluation.rejected.map(({ url, reason }) => `- [댓글](${url}) — ${reason}`),
      ''
    );
  }

  lines.push(...howToAnswer(docsUrl));

  return lines.join('\n');
}

/**
 * 라벨이 떼어져 검사 대상에서 빠질 때 한 번 남기는 댓글.
 *
 * @param {ReturnType<typeof evaluateIssue>} evaluation
 */
export function renderUnlabeledNote(evaluation) {
  const count = countAnswers(evaluation);

  return `\`${LABEL}\` 라벨이 떼어져 **검사 대상에서 빠졌습니다**(답 ${count.answered}/${count.total}인 채). 다시 검사하려면 라벨을 다시 붙입니다.`;
}
