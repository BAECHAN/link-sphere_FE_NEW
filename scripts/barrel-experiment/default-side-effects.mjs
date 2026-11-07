// 배럴 비용 비교 실험의 보조 측정(docs/PERFORMANCE.md "배럴 비교"). 번들이 세 변형 모두 같게 나온 이유를 보려고 실험 워크트리의
// vite.config.ts에서 treeshake.moduleSideEffects만 Rollup 기본값(true)으로 바꾼다. 재고 나면 각 워크트리에서
// git checkout -- vite.config.ts로 되돌린다.
//
//   node scripts/barrel-experiment/default-side-effects.mjs --exp <워크트리 부모>

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const exp = path.resolve(argv[argv.indexOf('--exp') + 1]);

for (const variant of ['a', 'b', 'c']) {
  const target = path.join(exp, `barrel-exp-${variant}`, 'vite.config.ts');
  const source = fs.readFileSync(target, 'utf8');
  const next = source.replace(
    /moduleSideEffects: \(id\) => \{[\s\S]*?\n {10}\},/,
    'moduleSideEffects: true,'
  );

  if (next === source) {
    throw new Error(`moduleSideEffects 함수를 찾지 못했다: ${target}`);
  }

  fs.writeFileSync(target, next);
}
