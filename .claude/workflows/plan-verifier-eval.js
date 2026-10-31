export const meta = {
  name: 'plan-verifier-eval',
  description: '결함을 넣은 계획 대조 사례로 에이전트 한 종류를 채점한다(사례마다 에이전트 1개)',
  whenToUse: 'plan-verifier와 general-purpose의 계획 대조 품질을 같은 사례로 비교할 때',
  phases: [{ title: 'Verify', detail: '사례마다 계획 대비 구현 대조 후 정답 키로 채점' }],
};

// args: { agentType, cases } — cases는 .claude/scripts/plan-eval-cases.mjs 출력의 cases 그대로다.
// 채점은 결정적이다. 지적(이탈·미구현 항목, 계획에 없던 변경)의 파일 경로가 정답 파일과 맞는지만 본다.
// - 검출: 결함 사례에서 뺀 파일·끼운 파일을 짚은 지적이 하나라도 있으면 그 결함을 잡은 것이다.
// - 오탐: 어느 정답 파일(known·removed·inserted)도 짚지 않은 지적이다. 정상 사례 기준으로 판정한다.
// 근거: docs/plans/2026-10-31-ai-loop-graph-readiness.md Phase 1.

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          verdict: { enum: ['implemented', 'deviation', 'missing', 'out-of-scope'] },
          files: { type: 'array', items: { type: 'string' }, minItems: 1 },
          note: { type: 'string' },
        },
        required: ['item', 'verdict', 'files', 'note'],
      },
    },
    unplanned: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string' }, minItems: 1 },
          note: { type: 'string' },
        },
        required: ['files', 'note'],
      },
    },
  },
  required: ['items', 'unplanned'],
};

const promptFor = (c) =>
  [
    'CLAUDE.md §11의 계획 대비 구현 대조를 해 줘.',
    `- 계획 파일: ${c.planPath}`,
    `- diff 파일: ${c.diffPath} (머지된 PR의 squash 커밋 diff에서 계획 파일만 뺐다)`,
    '이 두 파일만 읽어. 저장소의 지금 파일은 이 PR 뒤에 바뀌어서 근거가 되지 않는다.',
    '결과는 구조화 출력으로 낸다.',
    '- items: 계획 항목마다 verdict(implemented·deviation·missing·out-of-scope)와 근거 파일 경로 files(저장소 루트 기준). 줄 번호와 이유는 note에.',
    '- unplanned: diff에 있지만 어느 계획 항목에도 닿지 않는 변경의 파일 경로와 설명.',
  ].join('\n');

const normalize = (reported) =>
  reported
    .replace(/[`'"]/g, '')
    .trim()
    .replace(/^[ab]\//, '')
    .replace(/^\.\//, '')
    .replace(/:\d.*$/, '');

const matches = (reported, target) => {
  const value = normalize(reported);

  return (
    value !== '' &&
    (value === target || target.endsWith(`/${value}`) || value.endsWith(`/${target}`))
  );
};

function score(c, output) {
  const targets = [...c.removed, ...c.inserted];

  if (!output) {
    return {
      id: c.id,
      pr: c.pr,
      role: c.role,
      failed: true,
      detected: [],
      missed: targets,
      falsePositives: [],
    };
  }

  const findings = [
    ...output.items.filter((i) => i.verdict === 'deviation' || i.verdict === 'missing'),
    ...output.unplanned,
  ];
  const touches = (finding, files) => finding.files.some((f) => files.some((t) => matches(f, t)));
  const detected = targets.filter((t) => findings.some((f) => touches(f, [t])));

  return {
    id: c.id,
    pr: c.pr,
    role: c.role,
    failed: false,
    detected,
    missed: targets.filter((t) => !detected.includes(t)),
    falsePositives: findings
      .filter((f) => !touches(f, [...c.known, ...targets]))
      .map((f) => ({ files: f.files, note: f.note })),
  };
}

// 2026-10-31 평가 첫 실행에서 args가 JSON 문자열로 들어와 `pipeline() expects an array`로 끝났다.
const input = typeof args === 'string' ? JSON.parse(args) : args;

phase('Verify');

const results = await pipeline(input.cases, (c) =>
  agent(promptFor(c), {
    label: `${input.agentType}:${c.id}`,
    phase: 'Verify',
    agentType: input.agentType,
    schema: OUTPUT_SCHEMA,
  }).then((output) => score(c, output))
);

const scored = results.filter(Boolean);
const normal = scored.filter((r) => r.role === 'normal');
const defect = scored.filter((r) => r.role === 'defect');
const sum = (list, pickCount) => list.reduce((total, r) => total + pickCount(r), 0);

return {
  agentType: input.agentType,
  detected: sum(defect, (r) => r.detected.length),
  expected: sum(defect, (r) => r.detected.length + r.missed.length),
  normalFalsePositives: sum(normal, (r) => r.falsePositives.length),
  normalCases: normal.length,
  defectFalsePositives: sum(defect, (r) => r.falsePositives.length),
  failedCases: scored.filter((r) => r.failed).map((r) => r.id),
  cases: scored,
};
