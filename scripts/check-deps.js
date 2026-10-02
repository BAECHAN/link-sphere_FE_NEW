// `pnpm check:deps` — .dependency-cruiser.cjs의 forbidden 규칙(entities는 @x로만, features·widgets는
// 같은 레이어 다른 슬라이스 import 금지, package.json에 없는 패키지 금지, production 코드의
// devDependency 금지)을 검사한다. `pnpm check`에 들어 있어
// 로컬·CI(ci.yml)·배포(deploy.yml)가 같은 명령으로 막힌다(docs/plans/2026-10-01-dependency-cruiser.md).
import { runDepcruise } from './lib/depcruise.js';

const startedAt = performance.now();
const { summary } = runDepcruise();
const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);

for (const violation of summary.violations) {
  // npm 패키지는 resolved 경로(node_modules/.pnpm/...)보다 import한 이름이 읽기 쉽다
  const target = violation.to.startsWith('node_modules/')
    ? (violation.unresolvedTo ?? violation.to)
    : violation.to;
  console.error(`✖ ${violation.rule.name}: ${violation.from} → ${target}`);
}

if (summary.error > 0) {
  console.error(
    `\n의존성 규칙 위반 ${summary.error}건 — 규칙 설명은 .dependency-cruiser.cjs의 comment 참고`
  );
  process.exitCode = 1;
} else {
  console.log(`✔ 의존성 규칙 위반 없음 (모듈 ${summary.totalCruised}개, ${seconds}초)`);
}
