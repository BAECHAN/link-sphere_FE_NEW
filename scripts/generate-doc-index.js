// docs/DECISIONS.md(결정 98개, 목차 없음)와 docs/plans/(계획 200여 개, 색인 없음)를 찾아 읽을 수 있게
// 색인 두 개를 만든다: docs/DECISIONS-INDEX.md, docs/PLANS-INDEX.md. 2026-11-18, 문서량 점검에서 "유지 검사
// 부담보다 찾기가 문제"로 판정한 뒤 만들었다(docs/plans/2026-11-18-doc-index-plan-weight.md).
//
// 원본은 읽기만 한다. 계획 색인을 docs/plans/ 밖에 두는 것은 CI가 그 폴더의 수정을 막아서다
// (.github/workflows/ci.yml "docs/plans 불변성 확인").
//
// 사용법:
//   node scripts/generate-doc-index.js           색인을 다시 쓴다
//   node scripts/generate-doc-index.js --check   디스크의 색인이 생성 결과와 같은지만 본다(다르면 exit 1)
//
// 정직한 한계: 결정 링크는 GitHub가 헤딩에서 만드는 앵커를 흉내 낸 값이다(lib/doc-index.js toHeadingAnchor).
// 헤딩 문구를 고치면 앵커가 바뀌므로 색인을 다시 만들어야 한다. 주제 분류는 사람이 정한 표라 새 결정을
// 더하면 scripts/lib/decision-topics.json에도 한 줄을 더해야 한다(없으면 실패한다).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import * as prettier from 'prettier';

import {
  findUnclassified,
  parseDecisions,
  parsePlan,
  renderDecisionIndex,
  renderPlanIndex,
} from './lib/doc-index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DECISIONS_PATH = 'docs/DECISIONS.md';
const PLANS_DIR = 'docs/plans';
const TOPICS_PATH = 'scripts/lib/decision-topics.json';
const OUTPUTS = { decisions: 'docs/DECISIONS-INDEX.md', plans: 'docs/PLANS-INDEX.md' };

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

/** lint-staged가 md에 prettier --write를 돌리므로, 커밋 뒤에도 --check가 맞도록 같은 설정으로 맞춘다. */
async function format(relPath, content) {
  const absPath = path.join(ROOT, relPath);
  const options = await prettier.resolveConfig(absPath);

  return prettier.format(content, { ...options, filepath: absPath });
}

async function build() {
  const topics = JSON.parse(read(TOPICS_PATH));
  const decisions = parseDecisions(read(DECISIONS_PATH));
  const unclassified = findUnclassified(decisions, topics);

  if (unclassified.length > 0) {
    console.error(`${TOPICS_PATH}에 주제가 없는 결정 ${unclassified.length}개:`);
    unclassified.forEach((key) => console.error(`  ${key}`));
    process.exit(1);
  }

  const plans = fs
    .readdirSync(path.join(ROOT, PLANS_DIR))
    .map((fileName) => parsePlan(fileName, read(`${PLANS_DIR}/${fileName}`)))
    .filter(Boolean);

  return {
    [OUTPUTS.decisions]: await format(OUTPUTS.decisions, renderDecisionIndex(decisions, topics)),
    [OUTPUTS.plans]: await format(OUTPUTS.plans, renderPlanIndex(plans)),
  };
}

async function main() {
  const isCheck = process.argv.includes('--check');
  const built = await build();
  const stale = [];

  for (const [relPath, content] of Object.entries(built)) {
    const absPath = path.join(ROOT, relPath);
    const current = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf8') : null;

    if (current === content) {
      continue;
    }

    if (isCheck) {
      stale.push(relPath);
      continue;
    }

    fs.writeFileSync(absPath, content);
    console.log(`${relPath} 갱신`);
  }

  if (stale.length > 0) {
    console.error(`색인이 낡았습니다: ${stale.join(', ')} — pnpm docs:index로 다시 만드세요.`);
    process.exit(1);
  }
}

main();
