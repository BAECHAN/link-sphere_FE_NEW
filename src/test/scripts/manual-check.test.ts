import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 판정 규칙을 여기서 검증한다(선례: pr-body.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import {
  decideActions,
  evaluateIssue,
  LABEL,
  parseIssueBody,
  renderStatusComment,
  renderUnlabeledNote,
  STATUS_MARKER,
} from '../../../scripts/lib/manual-check.js';

const BODY = `## 무엇을 확인하나

북마크 시트 뒤로가기 변경이 배포된 뒤 Android 폰 Chrome에서 본다.

## 왜 사람이 봐야 하나

- 자동 검사는 실제 Android 뒤로 버튼을 누르지 못한다.

## 확인 항목

확인할 빌드: 890e4c5 이후

1. 피드에서 북마크 버튼을 눌러 시트를 띄우고 하단 뒤로 버튼을 누른다
   - 기대: 시트만 닫히고 피드는 그대로다
   - 적을 것: 뒤로 버튼을 누른 뒤 보이는 화면
2. 시트에서 "새 폴더 만들기"를 눌러 이름을 쓴다
   - 기대: 키보드가 올라와도 입력 줄이 보인다
   - 적을 것: 키보드가 뜬 뒤 입력 줄과 버튼이 보이는지

## 결과에 따라

- 1에서 페이지가 뒤로 가면 원인부터 조사한다.
`;

const OWNER = { authorAssociation: 'OWNER', userType: 'User' } as const;
const acceptAnyBuild = () => null;

function comment(
  body: string,
  overrides: Partial<Parameters<typeof evaluateIssue>[0]['comments'][number]> = {}
) {
  return { body, url: `https://example.test/c/${body.length}`, ...OWNER, ...overrides };
}

describe('parseIssueBody', () => {
  it('형식이 맞는 본문에서 확인할 빌드와 단계를 뽑는다', () => {
    const parsed = parseIssueBody(BODY);

    expect(parsed.problems).toEqual([]);
    expect(parsed.requiredBuild).toBe('890e4c5');
    expect(parsed.steps).toEqual([
      {
        number: 1,
        action: '피드에서 북마크 버튼을 눌러 시트를 띄우고 하단 뒤로 버튼을 누른다',
        expectation: '시트만 닫히고 피드는 그대로다',
        toRecord: '뒤로 버튼을 누른 뒤 보이는 화면',
      },
      {
        number: 2,
        action: '시트에서 "새 폴더 만들기"를 눌러 이름을 쓴다',
        expectation: '키보드가 올라와도 입력 줄이 보인다',
        toRecord: '키보드가 뜬 뒤 입력 줄과 버튼이 보이는지',
      },
    ]);
  });

  it('"확인할 빌드: 없음"이면 빌드를 요구하지 않는다', () => {
    const parsed = parseIssueBody(BODY.replace('확인할 빌드: 890e4c5 이후', '확인할 빌드: 없음'));

    expect(parsed.problems).toEqual([]);
    expect(parsed.requiredBuild).toBeNull();
  });

  it('필수 절이 없거나 비어 있으면 형식 오류다', () => {
    const withoutWhy = BODY.replace(
      '## 왜 사람이 봐야 하나\n\n- 자동 검사는 실제 Android 뒤로 버튼을 누르지 못한다.\n\n',
      ''
    );
    const emptyWhy = BODY.replace('- 자동 검사는 실제 Android 뒤로 버튼을 누르지 못한다.', '');

    expect(parseIssueBody(withoutWhy).problems).toEqual([
      expect.stringContaining('"## 왜 사람이 봐야 하나" 절이 없습니다'),
    ]);
    expect(parseIssueBody(emptyWhy).problems).toEqual([
      expect.stringContaining('"## 왜 사람이 봐야 하나" 절이 비어 있습니다'),
    ]);
  });

  it('빈 본문(null)은 필수 절이 모두 없다고 본다', () => {
    expect(parseIssueBody(null).problems).toHaveLength(4);
  });

  it('확인할 빌드 줄이 없으면 형식 오류다', () => {
    const parsed = parseIssueBody(BODY.replace('확인할 빌드: 890e4c5 이후\n', ''));

    expect(parsed.problems).toEqual([expect.stringContaining('"확인할 빌드:" 줄이 없습니다')]);
  });

  it('단계가 없으면 형식 오류다', () => {
    const body = BODY.replace(/\n1\. [\s\S]*?(?=\n## 결과에 따라)/, '\n');

    expect(parseIssueBody(body).problems).toEqual([
      expect.stringContaining('번호 붙은 단계가 없습니다'),
    ]);
  });

  it('번호가 1부터 이어지지 않으면 형식 오류다', () => {
    const body = BODY.replace('\n2. 시트에서', '\n3. 시트에서');

    expect(parseIssueBody(body).problems).toEqual([
      expect.stringContaining('단계 번호는 1부터 차례로'),
    ]);
  });

  it('단계에 기대나 적을 것이 빠지면 형식 오류다', () => {
    const body = BODY.replace('   - 적을 것: 뒤로 버튼을 누른 뒤 보이는 화면\n', '').replace(
      '   - 기대: 키보드가 올라와도 입력 줄이 보인다\n',
      ''
    );

    expect(parseIssueBody(body).problems).toEqual([
      expect.stringContaining('1번 단계에 "적을 것:"이 없습니다'),
      expect.stringContaining('2번 단계에 "기대:"가 없습니다'),
    ]);
  });
});

describe('evaluateIssue', () => {
  it('답이 빠진 단계가 있으면 incomplete이고 남은 단계를 알려 준다', () => {
    const result = evaluateIssue({
      body: BODY,
      comments: [comment('빌드: cbc937c\n1. 통과 — 시트만 닫혔고 피드 스크롤 위치도 그대로')],
      checkBuild: acceptAnyBuild,
    });

    expect(result.status).toBe('incomplete');
    expect(result.missing).toEqual([2]);
    expect(result.answers[0]).toMatchObject({
      number: 1,
      verdict: '통과',
      observation: '시트만 닫혔고 피드 스크롤 위치도 그대로',
      build: 'cbc937c',
    });
    expect(result.answers[1]).toBeNull();
  });

  it('구분 기호가 하이픈·콜론이거나 없어도, 빌드 값에 백틱이 있어도 답으로 읽는다', () => {
    const result = evaluateIssue({
      body: BODY,
      comments: [
        comment(
          '빌드: `CBC937C`\n1. 통과 - 시트만 닫히고 피드 그대로\n2) 실패: 키보드가 입력 줄을 가림'
        ),
      ],
      checkBuild: acceptAnyBuild,
    });

    expect(result.status).toBe('failed');
    expect(result.failed).toEqual([2]);
    expect(result.answers[0]).toMatchObject({ verdict: '통과', build: 'cbc937c' });
    expect(result.answers[1]).toMatchObject({
      verdict: '실패',
      observation: '키보드가 입력 줄을 가림',
    });
  });

  it('모든 단계가 통과로 답해지면 passed다', () => {
    const result = evaluateIssue({
      body: BODY,
      comments: [
        comment(
          '빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로\n2. 통과 — 입력 줄과 버튼이 다 보임'
        ),
      ],
      checkBuild: acceptAnyBuild,
    });

    expect(result.status).toBe('passed');
    expect(result.missing).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('본문 형식이 틀리면 답이 있어도 malformed다', () => {
    const result = evaluateIssue({
      body: BODY.replace('확인할 빌드: 890e4c5 이후\n', ''),
      comments: [comment('빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로')],
      checkBuild: acceptAnyBuild,
    });

    expect(result.status).toBe('malformed');
    expect(result.bodyProblems).toHaveLength(1);
  });

  it('저장소 주인이 아닌 사람·봇의 댓글과 상태 댓글은 답으로 세지 않는다', () => {
    const answers =
      '빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로\n2. 통과 — 입력 줄과 버튼이 다 보임';
    const result = evaluateIssue({
      body: BODY,
      comments: [
        comment(answers, { authorAssociation: 'NONE' }),
        comment(answers, { authorAssociation: 'CONTRIBUTOR' }),
        comment(answers, { userType: 'Bot' }),
        comment(`${STATUS_MARKER}\n${answers}`),
      ],
      checkBuild: acceptAnyBuild,
    });

    expect(result.status).toBe('incomplete');
    expect(result.missing).toEqual([1, 2]);
    expect(result.rejected).toEqual([]);
  });

  it('빌드 줄이 없는 댓글의 답은 세지 않고 이유와 그 댓글 주소를 남긴다', () => {
    const answer = comment('1. 통과 — 시트만 닫히고 피드 그대로');
    const result = evaluateIssue({ body: BODY, comments: [answer], checkBuild: acceptAnyBuild });

    expect(result.missing).toEqual([1, 2]);
    expect(result.rejected).toEqual([
      { url: answer.url, reason: expect.stringContaining('"빌드:" 줄이 없습니다') as string },
    ]);
  });

  it('빌드 대조가 거절한 댓글의 답은 세지 않고 그 이유를 남긴다', () => {
    const checkBuild = vi.fn(() => '확인할 빌드(890e4c5)보다 앞선 빌드입니다');
    const result = evaluateIssue({
      body: BODY,
      comments: [comment('빌드: 1111111\n1. 통과 — 시트만 닫히고 피드 그대로')],
      checkBuild,
    });

    expect(checkBuild).toHaveBeenCalledWith('1111111', '890e4c5');
    expect(result.missing).toEqual([1, 2]);
    expect(result.rejected.map(({ reason }) => reason)).toEqual([
      expect.stringContaining('앞선 빌드'),
    ]);
  });

  it('"확인할 빌드: 없음"이면 빌드 줄 없이도 답을 세고 빌드를 대조하지 않는다', () => {
    const checkBuild = vi.fn(() => '불려서는 안 된다');
    const result = evaluateIssue({
      body: BODY.replace('확인할 빌드: 890e4c5 이후', '확인할 빌드: 없음'),
      comments: [
        comment('1. 통과 — 시트만 닫히고 피드 그대로\n2. 통과 — 입력 줄과 버튼이 다 보임'),
      ],
      checkBuild,
    });

    expect(checkBuild).not.toHaveBeenCalled();
    expect(result.status).toBe('passed');
    expect(result.answers[0]).toMatchObject({ build: null });
  });

  it('판정이 통과·실패가 아니거나 본 것이 5자 미만이면 그 답을 세지 않는다', () => {
    const result = evaluateIssue({
      body: BODY,
      comments: [comment('빌드: cbc937c\n1. 확인함 — 시트만 닫히고 피드 그대로\n2. 통과 — 잘 됨')],
      checkBuild: acceptAnyBuild,
    });

    expect(result.missing).toEqual([1, 2]);
    expect(result.rejected.map(({ reason }) => reason)).toEqual([
      expect.stringContaining('1번: 판정은 "통과"나 "실패"'),
      expect.stringContaining('2번: 본 것을 5자 이상'),
    ]);
  });

  it('본문에 없는 단계 번호의 답은 세지 않는다', () => {
    const result = evaluateIssue({
      body: BODY,
      comments: [comment('빌드: cbc937c\n3. 통과 — 세 번째 단계도 잘 됐음')],
      checkBuild: acceptAnyBuild,
    });

    expect(result.rejected.map(({ reason }) => reason)).toEqual([
      expect.stringContaining('3번: 본문에 없는 단계'),
    ]);
  });

  it('같은 단계에 답이 여럿이면 가장 늦은 답을 센다', () => {
    const result = evaluateIssue({
      body: BODY,
      comments: [
        comment(
          '빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로\n2. 실패 — 키보드가 입력 줄을 가림'
        ),
        comment('빌드: dddd444\n2. 통과 — 고친 뒤 입력 줄이 다 보임'),
      ],
      checkBuild: acceptAnyBuild,
    });

    expect(result.status).toBe('passed');
    expect(result.answers[1]).toMatchObject({ verdict: '통과', build: 'dddd444' });
  });

  it('늦게 온 답이 세지 않는 답이면 앞선 답을 덮지 않는다', () => {
    const result = evaluateIssue({
      body: BODY,
      comments: [
        comment(
          '빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로\n2. 실패 — 키보드가 입력 줄을 가림'
        ),
        comment('2. 통과 — 고친 뒤 입력 줄이 다 보임'),
      ],
      checkBuild: acceptAnyBuild,
    });

    expect(result.status).toBe('failed');
    expect(result.answers[1]).toMatchObject({ verdict: '실패' });
    expect(result.rejected).toHaveLength(1);
  });

  it('확인할 빌드가 main에 없는 값이면 답을 기다리지 않고 본문 형식 오류로 본다', () => {
    const checkRequiredBuild = vi.fn(() => '확인할 빌드(890e4c5)를 저장소에서 찾지 못했습니다');
    const result = evaluateIssue({
      body: BODY,
      comments: [
        comment(
          '빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로\n2. 통과 — 입력 줄과 버튼이 다 보임'
        ),
      ],
      checkBuild: acceptAnyBuild,
      checkRequiredBuild,
    });

    expect(checkRequiredBuild).toHaveBeenCalledWith('890e4c5');
    expect(result.status).toBe('malformed');
    expect(result.bodyProblems).toEqual(['확인할 빌드(890e4c5)를 저장소에서 찾지 못했습니다']);
  });

  it('"확인할 빌드: 없음"이면 확인할 빌드를 저장소와 대조하지 않는다', () => {
    const checkRequiredBuild = vi.fn(() => '불려서는 안 된다');
    const result = evaluateIssue({
      body: BODY.replace('확인할 빌드: 890e4c5 이후', '확인할 빌드: 없음'),
      comments: [],
      checkBuild: acceptAnyBuild,
      checkRequiredBuild,
    });

    expect(checkRequiredBuild).not.toHaveBeenCalled();
    expect(result.status).toBe('incomplete');
  });
});

describe('decideActions', () => {
  const evaluate = (comments: string[], body = BODY) =>
    evaluateIssue({
      body,
      comments: comments.map((text) => comment(text)),
      checkBuild: acceptAnyBuild,
    });
  const incomplete = evaluate([]);
  const failed = evaluate([
    '빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로\n2. 실패 — 키보드가 입력 줄을 가림',
  ]);
  const passed = evaluate([
    '빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로\n2. 통과 — 입력 줄과 버튼이 다 보임',
  ]);
  const malformed = evaluate([], BODY.replace('확인할 빌드: 890e4c5 이후\n', ''));
  const closedEvent = {
    name: 'issues',
    action: 'closed',
    state: 'closed',
    labelRemoved: false,
  } as const;

  it('답이 빠졌거나 실패가 있거나 형식이 틀린 채 닫히면 다시 연다', () => {
    for (const evaluation of [incomplete, failed, malformed]) {
      expect(decideActions(evaluation, closedEvent)).toEqual({
        reopen: true,
        close: false,
        noteUnlabeled: false,
        updateStatus: true,
      });
    }
  });

  it('열려 있는 이슈는 다시 열지 않고 상태 댓글만 갱신한다', () => {
    expect(
      decideActions(incomplete, {
        name: 'issues',
        action: 'opened',
        state: 'open',
        labelRemoved: false,
      })
    ).toEqual({ reopen: false, close: false, noteUnlabeled: false, updateStatus: true });
  });

  it('모두 통과이고 댓글 이벤트면 닫는다', () => {
    expect(
      decideActions(passed, {
        name: 'issue_comment',
        action: 'created',
        state: 'open',
        labelRemoved: false,
      })
    ).toMatchObject({ reopen: false, close: true });
  });

  it('답이 빠졌거나 실패가 있거나 형식이 틀리면 댓글 이벤트여도 닫지 않는다', () => {
    for (const evaluation of [incomplete, failed, malformed]) {
      expect(
        decideActions(evaluation, {
          name: 'issue_comment',
          action: 'created',
          state: 'open',
          labelRemoved: false,
        })
      ).toEqual({ reopen: false, close: false, noteUnlabeled: false, updateStatus: true });
    }
  });

  it('모두 통과여도 댓글 이벤트가 아니면 닫지 않는다(사용자가 다시 연 이슈를 곧바로 닫지 않는다)', () => {
    expect(
      decideActions(passed, {
        name: 'issues',
        action: 'reopened',
        state: 'open',
        labelRemoved: false,
      })
    ).toMatchObject({ reopen: false, close: false });
  });

  it('모두 통과인 채 닫혀 있으면 그대로 둔다', () => {
    expect(decideActions(passed, closedEvent)).toMatchObject({ reopen: false, close: false });
  });

  it('라벨이 떼어지면 기록 댓글만 남기고 다시 열거나 닫지 않는다', () => {
    expect(
      decideActions(incomplete, {
        name: 'issues',
        action: 'unlabeled',
        state: 'closed',
        labelRemoved: true,
      })
    ).toEqual({ reopen: false, close: false, noteUnlabeled: true, updateStatus: false });
  });
});

describe('renderStatusComment', () => {
  it('표식, 답 개수, 남은 단계, 세지 않은 답의 이유를 담는다', () => {
    const evaluation = evaluateIssue({
      body: BODY,
      comments: [
        comment('빌드: cbc937c\n1. 통과 — 시트만 닫혔고 | 피드는 그대로'),
        comment('2. 통과 — 입력 줄과 버튼이 다 보임'),
      ],
      checkBuild: acceptAnyBuild,
    });
    const text = renderStatusComment(
      evaluation,
      decideActions(evaluation, {
        name: 'issues',
        action: 'closed',
        state: 'closed',
        labelRemoved: false,
      })
    );

    expect(text.startsWith(STATUS_MARKER)).toBe(true);
    expect(text).toContain('답 1/2');
    expect(text).toContain('남은 단계: 2');
    expect(text).toContain('다시 열었습니다');
    expect(text).toContain('"빌드:" 줄이 없습니다');
    // 표 칸을 깨는 글자는 이스케이프한다
    expect(text).toContain('시트만 닫혔고 \\| 피드는 그대로');
  });

  it('본문 형식 오류면 고칠 곳을 적는다', () => {
    const evaluation = evaluateIssue({
      body: BODY.replace('확인할 빌드: 890e4c5 이후\n', ''),
      comments: [],
      checkBuild: acceptAnyBuild,
    });
    const text = renderStatusComment(
      evaluation,
      decideActions(evaluation, {
        name: 'issues',
        action: 'opened',
        state: 'open',
        labelRemoved: false,
      })
    );

    expect(text).toContain('본문 형식');
    expect(text).toContain('"확인할 빌드:" 줄이 없습니다');
  });

  it('모두 통과해 닫을 때는 닫는다고 적는다', () => {
    const evaluation = evaluateIssue({
      body: BODY,
      comments: [
        comment(
          '빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로\n2. 통과 — 입력 줄과 버튼이 다 보임'
        ),
      ],
      checkBuild: acceptAnyBuild,
    });
    const text = renderStatusComment(
      evaluation,
      decideActions(evaluation, {
        name: 'issue_comment',
        action: 'created',
        state: 'open',
        labelRemoved: false,
      })
    );

    expect(text).toContain('답 2/2');
    expect(text).toContain('모든 단계가 통과');
  });

  it('실패한 단계가 있으면 열어 둔다고 적는다', () => {
    const evaluation = evaluateIssue({
      body: BODY,
      comments: [
        comment(
          '빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로\n2. 실패 — 키보드가 입력 줄을 가림'
        ),
      ],
      checkBuild: acceptAnyBuild,
    });
    const text = renderStatusComment(
      evaluation,
      decideActions(evaluation, {
        name: 'issue_comment',
        action: 'created',
        state: 'open',
        labelRemoved: false,
      })
    );

    expect(text).toContain('답 2/2 · 통과 1 · 실패 1');
    expect(text).toContain('실패한 단계가 있어 열어 둡니다');
  });

  it('문서 주소를 받으면 꼬리말의 문서 이름을 그 주소로 건다(폰 앱·메일에서도 열리게)', () => {
    const evaluation = evaluateIssue({ body: BODY, comments: [], checkBuild: acceptAnyBuild });
    const actions = decideActions(evaluation, {
      name: 'issues',
      action: 'opened',
      state: 'open',
      labelRemoved: false,
    });
    const docsUrl = 'https://example.test/owner/repo/blob/main/docs/MANUAL-CHECK.md';

    expect(renderStatusComment(evaluation, actions, docsUrl)).toContain(
      `[docs/MANUAL-CHECK.md](${docsUrl})`
    );
    expect(renderStatusComment(evaluation, actions)).not.toContain('](');
  });
});

describe('renderUnlabeledNote', () => {
  it('라벨이 떼어진 때의 답 개수를 적는다', () => {
    const evaluation = evaluateIssue({
      body: BODY,
      comments: [comment('빌드: cbc937c\n1. 통과 — 시트만 닫히고 피드 그대로')],
      checkBuild: acceptAnyBuild,
    });

    expect(renderUnlabeledNote(evaluation)).toContain('답 1/2');
    expect(renderUnlabeledNote(evaluation)).toContain('검사 대상에서 빠졌습니다');
  });
});

describe('manual-check.yml', () => {
  // 워크플로의 job 조건과 셸은 판정 코드의 상수를 import할 수 없어 값을 직접 적는다
  const WORKFLOW = readFileSync(
    path.resolve(__dirname, '../../../.github/workflows/manual-check.yml'),
    'utf8'
  );

  it('job 조건이 보는 라벨 이름이 판정 코드의 라벨과 같다', () => {
    expect(WORKFLOW).toContain(`labels.*.name, '${LABEL}')`);
    expect(WORKFLOW).toContain(`github.event.label.name == '${LABEL}'`);
  });

  it('상태 댓글을 찾는 표식이 판정 코드의 표식과 같다', () => {
    expect(WORKFLOW).toContain(`marker='${STATUS_MARKER}'`);
  });
});
