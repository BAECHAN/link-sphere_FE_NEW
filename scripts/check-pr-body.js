// `node scripts/check-pr-body.js [본문 파일]` (= `pnpm check:pr-body [본문 파일]`)
//
// pr-body.yml이 PR이 열리거나 본문이 바뀌거나 커밋이 올라올 때 PR_BODY 환경변수로 본문을 넘겨 실행한다.
// 로컬에서는 `gh pr create --body-file`에 넘길 파일을 인자로 주면 PR을 열기 전에 같은 검사를 한다.
// 판정 규칙은 lib/pr-body.js, 왜 이 검사가 있는지는 docs/PR-BODY-CHECK.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPrBodyProblems } from './lib/pr-body.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_PATH = path.join(ROOT, '.github/pull_request_template.md');

const bodyFile = process.argv[2];
const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : process.env.PR_BODY;
const problems = findPrBodyProblems(body, fs.readFileSync(TEMPLATE_PATH, 'utf8'));

if (problems.length === 0) {
  console.log('PR 본문 필수 절 확인 통과');
  process.exit(0);
}

for (const problem of problems) {
  // GitHub Actions에서는 ::error::가 PR 체크 화면에 주석으로 뜬다
  console.log(process.env.GITHUB_ACTIONS ? `::error::${problem}` : `- ${problem}`);
}

console.log(
  '\n본문을 고치면 이 검사가 다시 돈다. 절 이름과 채우는 법은 .github/pull_request_template.md, 이유는 docs/PR-BODY-CHECK.md'
);
process.exit(1);
