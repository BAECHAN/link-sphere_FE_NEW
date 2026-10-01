// dependency-cruiser 실행을 한 곳에 모은다. `pnpm graph`(scripts/dep-graph.js)와 이후 추가할
// 검사 스크립트가 같은 입력·설정·안전장치를 쓰게 하려는 것이다(docs/plans/2026-10-01-dependency-cruiser.md).
//
// 안전장치: "위반 0건"과 "아무것도 안 봤음"을 구분하려고, 검사 결과가 비정상적으로 작으면
// 실패시킨다. 2026-10-01 일회성 실행(npx + --no-config)에서 워크트리 안의 디렉터리 `src`를 입력으로
// 주자 "0 modules"로 조용히 통과한 적이 있다(원인 미확인). import/no-cycle도 리졸버 설정이 하나
// 빠지면 0건으로 조용히 통과했던 선례가 있다(eslint.config.js 주석). 하한은 두 개다 — 모듈 수만
// 보면 `@/` 별칭이 깨진 경우를 못 잡는다. 별칭이 깨지면 풀리지 않은 import가 각각 모듈로 잡혀
// 모듈 수는 오히려 늘고(524 → 837), src끼리의 의존성만 사라진다(1,451 → 1). 2026-10-01 직접 측정,
// tsConfig를 뺀 설정으로 재현.
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DEPCRUISE_BIN = path.join(ROOT, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');

/**
 * 정상일 때는 2026-10-01 직접 측정한 524개(src 전체 + 방문만 하는 npm 패키지)가 나온다.
 * 파일이 크게 줄어도 오탐하지 않도록 여유를 둔 값이다.
 */
const MIN_CRUISED_MODULES = 300;

/** 정상일 때는 2026-10-01 직접 측정한 1,451개(src 파일이 다른 src 파일을 import한 수)가 나온다 */
const MIN_SRC_DEPENDENCIES = 1000;

function countSrcDependencies(modules) {
  return modules
    .filter((module) => module.source.startsWith('src/'))
    .flatMap((module) => module.dependencies)
    .filter((dependency) => dependency.resolved.startsWith('src/')).length;
}

/**
 * src 전체를 dependency-cruiser로 검사해 JSON 결과({ modules, summary })를 돌려준다.
 * `--reaches` 같은 필터는 넘기지 않는다 — 필터를 걸면 summary.totalCruised가 걸러진 뒤 개수가
 * 돼(2026-10-01 실측: useClickGuard 기준 51) 안전장치가 오작동한다. 필요한 부분은 호출부가
 * 결과에서 직접 고른다.
 */
export function runDepcruise() {
  const run = spawnSync(
    process.execPath,
    [
      DEPCRUISE_BIN,
      'src/**/*.{ts,tsx}',
      '--config',
      '.dependency-cruiser.cjs',
      '--output-type',
      'json',
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );

  // 위반이 있으면 dependency-cruiser가 0이 아닌 코드로 끝나지만 결과 JSON은 그대로 나온다 —
  // 종료 코드가 아니라 출력 유무로 실행 실패를 판단한다.
  if (run.error || !run.stdout) {
    throw new Error(`dependency-cruiser 실행 실패\n${run.error?.message ?? run.stderr}`);
  }

  const result = JSON.parse(run.stdout);
  const { totalCruised } = result.summary;

  if (totalCruised < MIN_CRUISED_MODULES) {
    throw new Error(
      `dependency-cruiser가 모듈 ${totalCruised}개만 검사했다(최소 ${MIN_CRUISED_MODULES}개). ` +
        '입력 경로(src/**/*.{ts,tsx})가 깨졌을 수 있다.'
    );
  }

  const srcDependencies = countSrcDependencies(result.modules);

  if (srcDependencies < MIN_SRC_DEPENDENCIES) {
    throw new Error(
      `src끼리의 의존성이 ${srcDependencies}개뿐이다(최소 ${MIN_SRC_DEPENDENCIES}개). ` +
        '.dependency-cruiser.cjs의 tsConfig(@/ 별칭 해석) 설정이 깨졌을 수 있다.'
    );
  }

  return result;
}
