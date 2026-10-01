// `pnpm graph <정규식>` — 정규식에 맞는 모듈(훅·컴포넌트 등)과, import를 따라 그 모듈에 닿는 모든
// 파일을 레이어별 색으로 칠한 그림(HTML)으로 보여준다. 2026-10-01 "어떤 훅이 어떤 컴포넌트에
// 쓰이는지 한눈에 보고 싶다"는 요청에서 시작했다(docs/plans/2026-10-01-dependency-cruiser.md).
//
// dependency-cruiser 내장 mermaid 리포터 대신 직접 그리는 이유: 같은 데이터로 두 방식을 렌더해
// 비교했을 때 내장 리포터는 폴더마다 중첩 상자를 만들어 그림이 옆으로 잘리고 읽기 어려웠다.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runDepcruise } from './lib/depcruise.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'node_modules/.cache/dep-graph');

/**
 * 그림에서 뺄 모듈. app/·main.tsx는 모든 경로가 거쳐 가는 루트라 그림만 복잡해지고,
 * 테스트·스토리는 "사용처"가 아니다.
 */
const EXCLUDED_PATTERN = /^src\/(app\/|main\.tsx$)|\.(test|stories)\.tsx?$/;

const LAYER_STYLES = {
  pages: 'fill:#fde2e2,stroke:#d9534f,color:#111',
  widgets: 'fill:#fff1cc,stroke:#e0a800,color:#111',
  features: 'fill:#dff3e4,stroke:#28a745,color:#111',
  entities: 'fill:#ede9fe,stroke:#7c3aed,color:#111',
  shared: 'fill:#dbeafe,stroke:#2563eb,color:#111',
};

function isGraphModule(source) {
  return source.startsWith('src/') && !EXCLUDED_PATTERN.test(source);
}

/** dependency-cruiser 결과에서 그림 대상 모듈끼리의 import만 남긴 인접 목록(from → to 집합) */
function buildGraph(modules) {
  const graph = new Map();

  for (const module of modules) {
    if (!isGraphModule(module.source)) {
      continue;
    }

    const imported = module.dependencies
      .map((dependency) => dependency.resolved)
      .filter(isGraphModule);
    graph.set(module.source, new Set(imported));
  }

  return graph;
}

/**
 * targets와, import를 거꾸로 따라 올라가 targets에 닿는 모든 모듈. dependency-cruiser의
 * `--reaches`와 같은 결과지만, CLI 필터를 쓰면 0건 안전장치가 오작동해 직접 계산한다
 * (scripts/lib/depcruise.js 주석 참고).
 */
function collectReachingModules(graph, targets) {
  const importersOf = new Map();

  for (const [from, imported] of graph) {
    for (const to of imported) {
      if (!importersOf.has(to)) {
        importersOf.set(to, []);
      }

      importersOf.get(to).push(from);
    }
  }

  const reached = new Set(targets);
  const queue = [...targets];

  while (queue.length > 0) {
    const current = queue.pop();

    for (const importer of importersOf.get(current) ?? []) {
      if (!reached.has(importer)) {
        reached.add(importer);
        queue.push(importer);
      }
    }
  }

  return reached;
}

/** 노드 라벨은 `파일명<br/>레이어/경로`, 색은 레이어별, highlighted 모듈은 굵은 테두리 */
function toMermaid(modules, edges, highlighted) {
  const ids = new Map([...modules].map((source, index) => [source, `n${index}`]));
  const lines = ['flowchart TB'];

  for (const [source, id] of ids) {
    const parts = source.split('/');
    const layer = parts[1];
    const name = parts.at(-1).replace(/\.tsx?$/, '');
    const location = parts.slice(1, -1).join('/');
    lines.push(`  ${id}["${name}<br/><small>${location}</small>"]:::${layer}`);
  }

  for (const [from, to] of edges) {
    lines.push(`  ${ids.get(from)} --> ${ids.get(to)}`);
  }

  for (const [layer, style] of Object.entries(LAYER_STYLES)) {
    lines.push(`  classDef ${layer} ${style}`);
  }

  for (const source of highlighted) {
    lines.push(`  style ${ids.get(source)} stroke-width:3px`);
  }

  return lines.join('\n');
}

function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function toHtml({ title, summary, mermaidText }) {
  const legend = Object.entries(LAYER_STYLES)
    .map(([layer, style]) => {
      const [fill, stroke] = style.split(',').map((declaration) => declaration.split(':')[1]);
      return `<span style="background:${fill};border:1px solid ${stroke}">${layer}</span>`;
    })
    .join('');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: -apple-system, system-ui, sans-serif; margin: 24px; background: #fff; color: #111; }
h1 { font-size: 20px; margin: 0 0 8px; }
p { color: #555; font-size: 13px; }
.legend span { display: inline-block; padding: 2px 8px; border-radius: 4px; margin-right: 6px; font-size: 13px; }
.graph { border: 1px solid #ddd; border-radius: 8px; padding: 12px; overflow: auto; margin-top: 12px; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(summary)}</p>
<div class="legend">${legend}</div>
<div class="graph"><pre class="mermaid">${escapeHtml(mermaidText)}</pre></div>
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
mermaid.initialize({ startOnLoad: true, securityLevel: 'loose', maxTextSize: 1000000, maxEdges: 10000 });
</script>
</body>
</html>
`;
}

function main() {
  const [mode, pattern] = process.argv.slice(2);

  if (mode !== '--reaches' || !pattern) {
    console.error('사용법: pnpm graph <정규식>   예) pnpm graph "useClickGuard[.]ts$"');
    process.exitCode = 1;
    return;
  }

  const graph = buildGraph(runDepcruise().modules);
  const matcher = new RegExp(pattern);
  const targets = [...graph.keys()].filter((source) => matcher.test(source));

  if (targets.length === 0) {
    console.error(`'${pattern}'에 맞는 모듈이 없다 (src/app/·main.tsx·테스트·스토리는 제외)`);
    process.exitCode = 1;
    return;
  }

  const reached = collectReachingModules(graph, targets);
  const edges = [...reached].flatMap((from) =>
    [...graph.get(from)].filter((to) => reached.has(to)).map((to) => [from, to])
  );
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const html = toHtml({
    title: `${pattern} 에 닿는 파일`,
    summary: `대상 ${targets.length}개 · 파일 ${reached.size}개 · import ${edges.length}개 — 화살표는 import 방향, 굵은 테두리는 대상, src/app/·main.tsx·테스트·스토리 제외 (기준 커밋 ${commit})`,
    mermaidText: toMermaid(reached, edges, targets),
  });
  const slug = pattern.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'graph';
  const file = path.join(OUTPUT_DIR, `${slug}.html`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(file, html);
  console.log(`파일 ${reached.size}개 · import ${edges.length}개 → ${file}`);

  if (process.platform === 'darwin') {
    execFileSync('open', [file]);
  }
}

main();
