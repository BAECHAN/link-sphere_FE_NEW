// 배럴 비용 비교 실험용 코드모드(docs/plans/2026-11-07-barrel-measurement.md). 대상 워크트리의 src를
// 배럴 구조로 바꾼다. 커밋하지 않는 1회용 변환이고, 같은 커밋에 다시 돌리면 같은 결과가 나온다.
//
//   B(FSD 공식형): entities·features·widgets 슬라이스마다 index.ts를 만들어 슬라이스 밖에서 쓰는 이름만
//     named re-export한다. 외부의 정적·동적 import는 배럴을 지나게 바꾼다.
//   C(통합 배럴): B에 더해 shared의 폴더별로 export * 배럴을 만들고 import를 바꾼다.
//
// 슬라이스 안쪽 import, @x, vi.mock 경로는 그대로 둔다. pages는 lazy 페이지를 묶으면 코드 분할이 깨져
// 대상에서 뺀다. 이름이 겹쳐 배럴로 묶지 못한 import는 직접 경로로 남기고 건수를 기록한다.
//
// 사용: node scripts/barrel-experiment/apply-barrels.mjs --root <워크트리> --variant b|c [--dry-run] [--compare <변환한 워크트리>]

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const C_SEGMENTS = [
  'shared/ui/atoms',
  'shared/ui/elements',
  'shared/ui/layouts',
  'shared/utils',
  'shared/config',
  'shared/hooks',
  'shared/lib',
];

function parseArgs(argv) {
  const args = { dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') {
      args.root = path.resolve(argv[(i += 1)]);
    } else if (argv[i] === '--variant') {
      args.variant = argv[(i += 1)];
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
    } else if (argv[i] === '--compare') {
      args.compareRoot = path.resolve(argv[(i += 1)]);
    }
  }

  if (!args.root || !['b', 'c'].includes(args.variant)) {
    throw new Error('--root <워크트리> --variant b|c 가 필요하다');
  }

  return args;
}

/** src 기준 모듈 경로가 속한 배럴 단위. 배럴 대상이 아니면 null */
function barrelUnitOf(modulePath, variant) {
  const parts = modulePath.split('/');

  if (parts.includes('@x')) {
    return null;
  }

  if (parts[0] === 'entities' && parts.length > 2) {
    return parts[1] === 'bookmark' ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/');
  }

  if ((parts[0] === 'features' || parts[0] === 'widgets') && parts.length > 3) {
    return parts.slice(0, 3).join('/');
  }

  if (variant === 'c') {
    return C_SEGMENTS.find((segment) => modulePath.startsWith(`${segment}/`)) ?? null;
  }

  return null;
}

function isBarrelMember(fileName) {
  return !/\.(test|stories)\.tsx?$|\.d\.ts$|(^|\/)index\.tsx?$/.test(fileName);
}

function run({ root, variant, dryRun, compareRoot }) {
  const require = createRequire(path.join(root, 'package.json'));
  const ts = require('typescript');
  const srcDir = path.join(root, 'src');

  const configPath = path.join(root, 'tsconfig.app.json');
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    }
  );
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const checker = program.getTypeChecker();

  const toModulePath = (fileName) =>
    path
      .relative(srcDir, fileName)
      .replace(/\\/g, '/')
      .replace(/\.tsx?$/, '');

  const sourceFiles = program
    .getSourceFiles()
    .filter((file) => file.fileName.startsWith(`${srcDir}/`) && !file.isDeclarationFile)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));

  const fileByModule = new Map(sourceFiles.map((file) => [toModulePath(file.fileName), file]));

  /** 모듈이 내보내는 이름과 값 여부 */
  const exportsOf = (modulePath) => {
    const file = fileByModule.get(modulePath);
    const symbol = file && checker.getSymbolAtLocation(file);

    if (!symbol) {
      return new Map();
    }

    return new Map(
      checker.getExportsOfModule(symbol).map((exported) => {
        const resolved =
          exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;

        return [exported.name, Boolean(resolved.flags & ts.SymbolFlags.Value)];
      })
    );
  };

  /** 대상 모듈이 배럴을 지나야 하는 외부 import면 그 단위를 돌려준다 */
  const crossingUnit = (importerModule, specifier) => {
    if (!specifier.startsWith('@/')) {
      return null;
    }

    const target = specifier.slice(2);
    const unit = barrelUnitOf(target, variant);

    if (!unit || !fileByModule.has(target) || !isBarrelMember(fileByModule.get(target).fileName)) {
      return null;
    }

    return barrelUnitOf(importerModule, variant) === unit ? null : { unit, target };
  };

  // 1단계: 슬라이스 밖에서 쓰는 이름을 모은다
  const usedByUnit = new Map();

  const useName = (unit, target, name) => {
    if (!usedByUnit.has(unit)) {
      usedByUnit.set(unit, new Map());
    }

    const names = usedByUnit.get(unit);

    if (!names.has(target)) {
      names.set(target, new Set());
    }

    names.get(target).add(name);
  };

  const visitImports = (file, onStatic, onDynamic) => {
    for (const statement of file.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        onStatic(statement);
      }
    }

    const walk = (node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        onDynamic(node.arguments[0]);
      }

      ts.forEachChild(node, walk);
    };

    walk(file);
  };

  for (const file of sourceFiles) {
    const importer = toModulePath(file.fileName);

    visitImports(
      file,
      (statement) => {
        const crossing = crossingUnit(importer, statement.moduleSpecifier.text);
        const bindings = statement.importClause?.namedBindings;

        if (crossing && bindings && ts.isNamedImports(bindings) && !statement.importClause.name) {
          for (const element of bindings.elements) {
            useName(crossing.unit, crossing.target, (element.propertyName ?? element.name).text);
          }
        }
      },
      (literal) => {
        const crossing = crossingUnit(importer, literal.text);

        if (crossing) {
          for (const name of exportsOf(crossing.target).keys()) {
            useName(crossing.unit, crossing.target, name);
          }
        }
      }
    );
  }

  // 2단계: 단위마다 배럴이 내보낼 이름을 정한다. 이름이 겹치면 먼저 나온 모듈만 배럴에 넣는다
  const barrelOwner = new Map();
  const collisions = [];
  const barrels = new Map();

  const units = new Set(usedByUnit.keys());

  if (variant === 'c') {
    C_SEGMENTS.forEach((segment) => units.add(segment));
  }

  for (const unit of [...units].sort()) {
    const owner = new Map();
    const isStarUnit = variant === 'c' && C_SEGMENTS.includes(unit);

    if (isStarUnit) {
      // export *는 겹치는 이름을 조용히 뺀다. 겹치는 이름은 모든 모듈에서 소유자 없음으로 둔다
      const members = [...fileByModule.keys()]
        .filter(
          (modulePath) =>
            barrelUnitOf(modulePath, variant) === unit &&
            isBarrelMember(fileByModule.get(modulePath).fileName) &&
            exportsOf(modulePath).size > 0
        )
        .sort();
      const seen = new Map();

      for (const member of members) {
        for (const name of exportsOf(member).keys()) {
          seen.set(name, seen.has(name) ? null : member);
        }
      }

      for (const [name, member] of seen) {
        if (member) {
          owner.set(name, member);
        } else {
          collisions.push(`${unit}: ${name}`);
        }
      }

      barrels.set(unit, members.map((member) => `export * from '@/${member}';`).join('\n') + '\n');
    } else {
      const lines = [];

      for (const target of [...usedByUnit.get(unit).keys()].sort()) {
        const exportsMap = exportsOf(target);
        const valueNames = [];
        const typeNames = [];

        for (const name of [...usedByUnit.get(unit).get(target)].sort()) {
          if (!exportsMap.has(name)) {
            collisions.push(`${unit}: ${name} (export를 찾지 못함)`);
          } else if (owner.has(name)) {
            collisions.push(`${unit}: ${name}`);
          } else {
            owner.set(name, target);
            (exportsMap.get(name) ? valueNames : typeNames).push(name);
          }
        }

        if (valueNames.length > 0) {
          lines.push(`export { ${valueNames.join(', ')} } from '@/${target}';`);
        }

        if (typeNames.length > 0) {
          lines.push(`export type { ${typeNames.join(', ')} } from '@/${target}';`);
        }
      }

      if (lines.length > 0) {
        barrels.set(unit, `${lines.join('\n')}\n`);
      }
    }

    barrelOwner.set(unit, owner);
  }

  // 3단계: import를 고쳐 쓴다
  const stats = {
    barrels: barrels.size,
    rewrittenStatic: 0,
    rewrittenDynamic: 0,
    keptDirectNames: 0,
    keptDirectForm: 0,
    collisions: collisions.length,
  };
  const outputs = new Map();

  for (const file of sourceFiles) {
    const importer = toModulePath(file.fileName);
    const edits = [];

    visitImports(
      file,
      (statement) => {
        const specifier = statement.moduleSpecifier.text;
        const crossing = crossingUnit(importer, specifier);

        if (!crossing) {
          return;
        }

        const clause = statement.importClause;
        const bindings = clause?.namedBindings;

        if (!bindings || !ts.isNamedImports(bindings) || clause.name) {
          stats.keptDirectForm += 1;

          return;
        }

        const owner = barrelOwner.get(crossing.unit);
        const viaBarrel = [];
        const direct = [];

        for (const element of bindings.elements) {
          const name = (element.propertyName ?? element.name).text;

          (owner?.get(name) === crossing.target ? viaBarrel : direct).push(element.getText(file));
        }

        if (viaBarrel.length === 0) {
          stats.keptDirectNames += direct.length;

          return;
        }

        const keyword = clause.isTypeOnly ? 'import type' : 'import';
        const replacement = [`${keyword} { ${viaBarrel.join(', ')} } from '@/${crossing.unit}';`];

        if (direct.length > 0) {
          replacement.push(`${keyword} { ${direct.join(', ')} } from '${specifier}';`);
          stats.keptDirectNames += direct.length;
        }

        stats.rewrittenStatic += 1;
        edits.push({
          start: statement.getStart(file),
          end: statement.getEnd(),
          text: replacement.join('\n'),
        });
      },
      (literal) => {
        const crossing = crossingUnit(importer, literal.text);

        if (crossing) {
          stats.rewrittenDynamic += 1;
          edits.push({
            start: literal.getStart(file),
            end: literal.getEnd(),
            text: `'@/${crossing.unit}'`,
          });
        }
      }
    );

    if (edits.length > 0) {
      let text = file.getFullText();

      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
      }

      outputs.set(file.fileName, text);
    }
  }

  for (const [unit, content] of barrels) {
    outputs.set(path.join(srcDir, unit, 'index.ts'), content);
  }

  // 전환 비용: e2e가 쓰는 픽스처의 타입 import가 배럴을 지나면 슬라이스 전체(.tsx 포함)가 e2e 타입 프로젝트로
  // 끌려온다. 타입체크를 통과시키는 최소 설정이다(2026-11-07 B·C에서 TS6142·TS2552·TS2339로 확인)
  const e2eTsconfigPath = path.join(root, 'tsconfig.e2e.json');
  const e2eTsconfig = fs.readFileSync(e2eTsconfigPath, 'utf8');

  if (!e2eTsconfig.includes('"jsx"')) {
    outputs.set(
      e2eTsconfigPath,
      e2eTsconfig
        .replace('"noEmit": true,', '"noEmit": true,\n    "jsx": "react-jsx",')
        .replace(
          '"dev-server.config.ts"]',
          '"dev-server.config.ts", "src/vite-env.d.ts", "src/types/*.d.ts"]'
        )
    );
  }

  const hash = createHash('sha256');

  for (const fileName of [...outputs.keys()].sort()) {
    hash.update(path.relative(root, fileName));
    hash.update(outputs.get(fileName));
  }

  if (!dryRun) {
    for (const [fileName, content] of outputs) {
      fs.writeFileSync(fileName, content);
    }
  }

  // 재현성 확인: 같은 커밋에서 만든 결과가 이미 변환한 워크트리의 파일과 같은지 본다
  const mismatches = compareRoot
    ? [...outputs.entries()]
        .map(([fileName, content]) => {
          const other = path.join(compareRoot, path.relative(root, fileName));

          return fs.existsSync(other) && fs.readFileSync(other, 'utf8') === content
            ? null
            : path.relative(root, fileName);
        })
        .filter(Boolean)
    : null;

  return {
    variant,
    dryRun,
    ...stats,
    changedFiles: outputs.size,
    hash: hash.digest('hex'),
    collisions,
    mismatches,
  };
}

const result = run(parseArgs(process.argv.slice(2)));

console.log(JSON.stringify({ ...result, collisions: result.collisions.slice(0, 40) }, null, 2));
