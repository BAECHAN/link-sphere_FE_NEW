// 배럴 비용 비교 실험의 보조 도구(docs/PERFORMANCE.md "배럴 비교"). src/test/setup.ts에서 값 import만 따라가 닿는
// 모듈 수를 A·C에서 세고, vi.mock 대상인 navigation.ts까지의 경로를 출력한다. --narrow면 A에서 닿는 파일을 C에서 A 내용으로
// 되돌린다 - C는 이 파일들이 배럴을 지나면 vi.mock보다 먼저 진짜 모듈이 올라와 단위 테스트 138개가 실패한다.
//
//   node scripts/barrel-experiment/setup-graph.mjs --exp <워크트리 부모> [--narrow]

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const argv = process.argv.slice(2);
const exp = path.resolve(argv[argv.indexOf('--exp') + 1]);
const rootA = path.join(exp, 'barrel-exp-a');
const rootC = path.join(exp, 'barrel-exp-c');
const ts = createRequire(path.join(rootA, 'package.json'))('typescript');

function resolveFile(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];

  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

function resolveImport(root, specifier, from) {
  if (specifier.startsWith('@/')) {
    return resolveFile(path.join(root, 'src', specifier.slice(2)));
  }

  return specifier.startsWith('.')
    ? resolveFile(path.resolve(path.dirname(from), specifier))
    : null;
}

function isTypeOnlyImport(clause) {
  const named = clause?.namedBindings;

  return (
    clause?.isTypeOnly ||
    (clause &&
      !clause.name &&
      named &&
      ts.isNamedImports(named) &&
      named.elements.length > 0 &&
      named.elements.every((element) => element.isTypeOnly))
  );
}

function isTypeOnlyExport(statement) {
  const named = statement.exportClause;

  return (
    statement.isTypeOnly ||
    (named &&
      ts.isNamedExports(named) &&
      named.elements.length > 0 &&
      named.elements.every((element) => element.isTypeOnly))
  );
}

function valueImports(file) {
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    kind
  );

  return source.statements
    .filter(
      (statement) =>
        (ts.isImportDeclaration(statement) && !isTypeOnlyImport(statement.importClause)) ||
        (ts.isExportDeclaration(statement) &&
          statement.moduleSpecifier &&
          !isTypeOnlyExport(statement))
    )
    .map((statement) => statement.moduleSpecifier.text);
}

/** setup.ts를 시작점으로 너비 우선 탐색한 부모 지도. 키가 닿은 파일이다 */
function reachableFrom(root) {
  const start = path.join(root, 'src/test/setup.ts');
  const parent = new Map([[start, null]]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift();

    for (const specifier of valueImports(current)) {
      const next = resolveImport(root, specifier, current);

      if (next && !parent.has(next)) {
        parent.set(next, current);
        queue.push(next);
      }
    }
  }

  return parent;
}

function report(root) {
  const parent = reachableFrom(root);
  const target = path.join(root, 'src/shared/lib/router/navigation.ts');
  const chain = [];

  for (let node = parent.has(target) ? target : null; node; node = parent.get(node)) {
    chain.unshift(path.relative(root, node));
  }

  console.log(`${path.basename(root)}: setup.ts에서 닿는 모듈 ${parent.size}개`);
  console.log(chain.length > 0 ? `  ${chain.join(' -> ')}` : '  navigation.ts에 닿지 않음');
}

if (argv.includes('--narrow')) {
  let changed = 0;

  for (const file of reachableFrom(rootA).keys()) {
    const target = path.join(rootC, path.relative(rootA, file));
    const content = fs.readFileSync(file, 'utf8');

    if (fs.readFileSync(target, 'utf8') !== content) {
      fs.writeFileSync(target, content);
      changed += 1;
    }
  }

  console.log(`C에서 되돌린 파일 ${changed}개`);
}

report(rootA);
report(rootC);
