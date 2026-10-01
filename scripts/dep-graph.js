// `pnpm graph <정규식>` — 정규식에 맞는 모듈(훅·컴포넌트 등)과, import를 따라 그 모듈에 닿는 모든
// 파일을 레이어별 색으로 칠한 그림(HTML)으로 보여준다. 2026-10-01 "어떤 훅이 어떤 컴포넌트에
// 쓰이는지 한눈에 보고 싶다"는 요청에서 시작했다(docs/plans/2026-10-01-dependency-cruiser.md).
// `pnpm graph:focus <정규식>`은 대상과 바로 이웃(대상이 import하는 파일·대상을 import하는 파일)만,
// `pnpm graph:archi`는 파일을 슬라이스 단위로 묶은 전체 구조를 그린다.
// `--affected <기준 커밋>`은 CI(ci.yml)가 PR마다 쓰는 모드로, 바뀐 파일과 거기에 닿는 파일을
// GitHub Actions Step Summary용 마크다운(Mermaid)으로 출력한다.
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
 * 테스트·스토리와 테스트 인프라(src/test 셋업, src/mocks MSW)는 "사용처"가 아니다.
 */
const EXCLUDED_PATTERN = /^src\/(app\/|main\.tsx$|test\/|mocks\/)|\.(test|stories)\.tsx?$/;
const EXCLUDED_DESCRIPTION = 'src/app/·main.tsx·테스트(src/test·src/mocks 포함)·스토리';

const LAYER_STYLES = {
  pages: 'fill:#fde2e2,stroke:#d9534f,color:#111',
  widgets: 'fill:#fff1cc,stroke:#e0a800,color:#111',
  features: 'fill:#dff3e4,stroke:#28a745,color:#111',
  entities: 'fill:#ede9fe,stroke:#7c3aed,color:#111',
  shared: 'fill:#dbeafe,stroke:#2563eb,color:#111',
};

/**
 * Step Summary 그림의 크기 상한. Mermaid 기본 한도(maxTextSize 50,000자, maxEdges 500개 —
 * https://mermaid.js.org/config/schema-docs/config.html)를 넘으면 그림 대신 오류 문구가 뜬다.
 * GitHub 렌더러가 기본값을 그대로 쓰는지는 확인하지 못해 여유를 둔다.
 */
const MAX_MERMAID_CHARS = 45000;
const MAX_MERMAID_EDGES = 450;

/**
 * 아키텍처 그림(--archi)에 넣는 레이어. shared는 뺀다 — 거의 모든 슬라이스가 shared를 써서
 * 슬라이스 사이 import의 68%가 shared로 향하고(2026-10-01 직접 측정: 306개 중 209개), 넣으면 그
 * 선들에 레이어 사이 흐름이 묻힌다. 빼면 97개만 남는다.
 */
const ARCHI_LAYERS = ['pages', 'widgets', 'features', 'entities'];

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

/** 모듈마다 그 모듈을 import하는 모듈 목록(to → from[]) — graph의 화살표를 뒤집은 것 */
function buildImportersOf(graph) {
  const importersOf = new Map();

  for (const [from, imported] of graph) {
    for (const to of imported) {
      if (!importersOf.has(to)) {
        importersOf.set(to, []);
      }

      importersOf.get(to).push(from);
    }
  }

  return importersOf;
}

/**
 * targets와, import를 거꾸로 따라 올라가 targets에 닿는 모든 모듈. dependency-cruiser의
 * `--reaches`와 같은 결과지만, CLI 필터를 쓰면 0건 안전장치가 오작동해 직접 계산한다
 * (scripts/lib/depcruise.js 주석 참고).
 */
function collectReachingModules(graph, targets) {
  const importersOf = buildImportersOf(graph);
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

/** nodes 안에서만 오가는 import(from, to) 목록 */
function edgesWithin(graph, nodes) {
  return [...nodes].flatMap((from) =>
    [...graph.get(from)].filter((to) => nodes.has(to)).map((to) => [from, to])
  );
}

/**
 * 슬라이스 단위로 접을 때의 묶음 키. features·widgets는 `도메인/슬라이스`, entities는
 * `bookmark/folder` 같은 그룹만 한 단계 더, shared는 `shared/ui/<그룹>`만 한 단계 더 내려간다.
 */
function sliceOf(source) {
  const parts = source.split('/');
  const [, layer, first] = parts;
  const deeper =
    layer === 'features' ||
    layer === 'widgets' ||
    (layer === 'entities' && first === 'bookmark') ||
    (layer === 'shared' && first === 'ui');
  const depth = deeper ? 4 : 3;

  return parts.slice(0, Math.min(depth, parts.length - 1)).join('/');
}

/** 노드(모듈 경로 또는 슬라이스 키)의 레이어 — 두 번째 경로 조각이다 */
function layerOf(node) {
  return node.split('/')[1];
}

/**
 * 노드 라벨은 labelOf(node), 색은 레이어별, highlighted 노드는 굵은 테두리. 노드는 모듈 경로
 * (`src/<레이어>/...`)거나 sliceOf()의 슬라이스 키다. direction은 Mermaid 흐름 방향
 * (TB 위→아래, LR 왼→오른).
 */
function toMermaid({ nodes, edges, highlighted, labelOf, direction = 'TB' }) {
  const ids = new Map([...nodes].map((node, index) => [node, `n${index}`]));
  const lines = [`flowchart ${direction}`];

  for (const [node, id] of ids) {
    lines.push(`  ${id}["${labelOf(node)}"]:::${layerOf(node)}`);
  }

  for (const [from, to] of edges) {
    lines.push(`  ${ids.get(from)} --> ${ids.get(to)}`);
  }

  for (const [layer, style] of Object.entries(LAYER_STYLES)) {
    lines.push(`  classDef ${layer} ${style}`);
  }

  for (const node of highlighted) {
    lines.push(`  style ${ids.get(node)} stroke-width:3px`);
  }

  return lines.join('\n');
}

/**
 * 모듈 라벨 `파일명<br/>레이어/경로`. `<small>`은 로컬 HTML에서만 쓴다 — GitHub 렌더러가
 * 라벨 안 HTML을 어디까지 허용하는지 확인하지 못했다.
 */
function moduleLabel(source, { small }) {
  const parts = source.split('/');
  const name = parts.at(-1).replace(/\.tsx?$/, '');
  const location = parts.slice(1, -1).join('/');

  return small ? `${name}<br/><small>${location}</small>` : `${name}<br/>${location}`;
}

function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * fitWidth면 그림을 화면 폭에 맞춰 축소하고(Mermaid 기본), 아니면 원래 크기로 그려 스크롤한다 —
 * 노드가 많은 그림은 폭에 맞추면 글자를 읽을 수 없을 만큼 작아진다.
 */
function toHtml({ title, summary, mermaidText, fitWidth = true }) {
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
mermaid.initialize({ startOnLoad: true, securityLevel: 'loose', maxTextSize: 1000000, maxEdges: 10000, flowchart: { useMaxWidth: ${fitWidth} } });
</script>
</body>
</html>
`;
}

function currentCommit() {
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

/** graph에서 정규식에 맞는 모듈. 없으면 안내를 찍고 null */
function matchTargets(graph, pattern) {
  const matcher = new RegExp(pattern);
  const targets = [...graph.keys()].filter((source) => matcher.test(source));

  if (targets.length === 0) {
    console.error(`'${pattern}'에 맞는 모듈이 없다 (${EXCLUDED_DESCRIPTION}는 제외)`);
    process.exitCode = 1;
    return null;
  }

  return targets;
}

/** node_modules/.cache/dep-graph/<name>.html로 저장하고 경로를 찍는다. macOS면 바로 연다 */
function writeHtmlAndOpen(name, html, countsLine) {
  const slug = name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'graph';
  const file = path.join(OUTPUT_DIR, `${slug}.html`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(file, html);
  console.log(`${countsLine} → ${file}`);

  if (process.platform === 'darwin') {
    execFileSync('open', [file]);
  }
}

function runReaches(pattern) {
  const graph = buildGraph(runDepcruise().modules);
  const targets = matchTargets(graph, pattern);

  if (!targets) {
    return;
  }

  const reached = collectReachingModules(graph, targets);
  const edges = edgesWithin(graph, reached);
  const html = toHtml({
    title: `${pattern} 에 닿는 파일`,
    summary: `대상 ${targets.length}개 · 파일 ${reached.size}개 · import ${edges.length}개 — 화살표는 import 방향, 굵은 테두리는 대상, ${EXCLUDED_DESCRIPTION} 제외 (기준 커밋 ${currentCommit()})`,
    mermaidText: toMermaid({
      nodes: reached,
      edges,
      highlighted: targets,
      labelOf: (source) => moduleLabel(source, { small: true }),
    }),
  });

  writeHtmlAndOpen(pattern, html, `파일 ${reached.size}개 · import ${edges.length}개`);
}

/**
 * 대상과 바로 이웃만 — 대상을 import하는 파일(그림 위쪽)과 대상이 import하는 파일(아래쪽),
 * 한 단계씩. dependency-cruiser의 `--focus`와 같은 범위를 runReaches와 같은 이유로 직접 계산한다.
 */
function runFocus(pattern) {
  const graph = buildGraph(runDepcruise().modules);
  const targets = matchTargets(graph, pattern);

  if (!targets) {
    return;
  }

  const importersOf = buildImportersOf(graph);
  const importers = new Set(targets.flatMap((target) => importersOf.get(target) ?? []));
  const imported = new Set(targets.flatMap((target) => [...graph.get(target)]));
  const nodes = new Set([...targets, ...importers, ...imported]);
  const edges = edgesWithin(graph, nodes);
  const html = toHtml({
    title: `${pattern} 의 바로 이웃`,
    summary: `대상 ${targets.length}개 · 대상을 import하는 파일 ${importers.size}개(위) · 대상이 import하는 파일 ${imported.size}개(아래) — 화살표는 import 방향, 굵은 테두리는 대상, ${EXCLUDED_DESCRIPTION} 제외 (기준 커밋 ${currentCommit()})`,
    mermaidText: toMermaid({
      nodes,
      edges,
      highlighted: targets,
      labelOf: (source) => moduleLabel(source, { small: true }),
    }),
  });

  writeHtmlAndOpen(
    `focus-${pattern}`,
    html,
    `위 ${importers.size}개 · 아래 ${imported.size}개 · import ${edges.length}개`
  );
}

/**
 * 전체 구조를 슬라이스 단위로 — 파일을 sliceOf()로 묶고 슬라이스 사이 import만 남긴다.
 * 왼쪽 → 오른쪽(pages → entities)으로 흐르고, 레이어는 색으로만 구분한다 — 레이어별 상자
 * (subgraph)로 묶어 봤더니 Mermaid가 큰 그림에서 상자를 서로 겹쳐 그렸다(2026-10-01 렌더 비교).
 * dependency-cruiser 내장 `archi` 리포터는 Graphviz가 있어야 그려져 Mermaid로 직접 그린다.
 * shared(ARCHI_LAYERS 주석 참고)와 src/types(전역 타입) 등 FSD 레이어 밖은 뺀다.
 */
function runArchi() {
  const graph = buildGraph(runDepcruise().modules);
  const isArchiModule = (source) => ARCHI_LAYERS.includes(layerOf(source));
  const filesPerSlice = new Map();

  for (const source of graph.keys()) {
    if (isArchiModule(source)) {
      filesPerSlice.set(sliceOf(source), (filesPerSlice.get(sliceOf(source)) ?? 0) + 1);
    }
  }

  const sliceEdges = [
    ...new Set(
      [...graph]
        .filter(([from]) => isArchiModule(from))
        .flatMap(([from, imported]) =>
          [...imported].filter(isArchiModule).map((to) => [sliceOf(from), sliceOf(to)])
        )
        .filter(([from, to]) => from !== to)
        .map((edge) => edge.join(' '))
    ),
  ].map((edge) => edge.split(' '));
  const html = toHtml({
    title: '아키텍처 — 슬라이스 단위',
    summary: `슬라이스 ${filesPerSlice.size}개 · 슬라이스 사이 import ${sliceEdges.length}개 — 화살표는 import 방향, 상자 안 숫자는 그 슬라이스의 파일 수, shared·${EXCLUDED_DESCRIPTION}·src/types 제외 (기준 커밋 ${currentCommit()})`,
    mermaidText: toMermaid({
      nodes: new Set(filesPerSlice.keys()),
      edges: sliceEdges,
      highlighted: [],
      labelOf: (slice) =>
        `${slice.split('/').slice(2).join('/') || layerOf(slice)}<br/><small>파일 ${filesPerSlice.get(slice)}개</small>`,
      direction: 'LR',
    }),
    fitWidth: false,
  });

  writeHtmlAndOpen(
    'architecture',
    html,
    `슬라이스 ${filesPerSlice.size}개 · import ${sliceEdges.length}개`
  );
}

function fitsMermaid(mermaidText, edgeCount) {
  return mermaidText.length <= MAX_MERMAID_CHARS && edgeCount <= MAX_MERMAID_EDGES;
}

/**
 * 바뀐 파일(changed)과 거기 닿는 파일(reached)의 그림을 마크다운으로. 모듈 단위 그림이 Mermaid
 * 한도를 넘으면 슬라이스 단위로 접고, 그래도 넘으면 슬라이스별 파일 수 표로 대신한다.
 */
function toAffectedMarkdown(graph, changed, reached) {
  const intro = `바뀐 파일 ${changed.length}개(굵은 테두리)와, import를 따라 이들에 닿는 파일 ${reached.size - changed.length}개다. 화살표는 import 방향이고, ${EXCLUDED_DESCRIPTION}는 제외했다.`;
  const edges = edgesWithin(graph, reached);
  const moduleMermaid = toMermaid({
    nodes: reached,
    edges,
    highlighted: changed,
    labelOf: (source) => moduleLabel(source, { small: false }),
  });

  if (fitsMermaid(moduleMermaid, edges.length)) {
    return `${intro}\n\n\`\`\`mermaid\n${moduleMermaid}\n\`\`\``;
  }

  const filesPerSlice = new Map();

  for (const source of reached) {
    filesPerSlice.set(sliceOf(source), (filesPerSlice.get(sliceOf(source)) ?? 0) + 1);
  }

  const sliceEdges = [
    ...new Set(
      edges
        .map(([from, to]) => [sliceOf(from), sliceOf(to)])
        .filter(([from, to]) => from !== to)
        .map((edge) => edge.join(' '))
    ),
  ].map((edge) => edge.split(' '));
  const sliceMermaid = toMermaid({
    nodes: new Set(filesPerSlice.keys()),
    edges: sliceEdges,
    highlighted: new Set(changed.map(sliceOf)),
    labelOf: (slice) => `${slice.slice('src/'.length)}<br/>파일 ${filesPerSlice.get(slice)}개`,
  });

  if (fitsMermaid(sliceMermaid, sliceEdges.length)) {
    return `${intro} 파일이 많아 슬라이스 단위(${filesPerSlice.size}개)로 접었다.\n\n\`\`\`mermaid\n${sliceMermaid}\n\`\`\``;
  }

  // 경로순으로 정렬하면 레이어끼리 모인다
  const rows = [...filesPerSlice]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slice, count]) => `| ${slice.slice('src/'.length)} | ${count} |`)
    .join('\n');
  const changedList = changed.map((source) => `- \`${source}\``).join('\n');

  return `${intro} 슬라이스 단위로 접어도 그림이 Mermaid 한도를 넘어 표로 대신한다.\n\n| 슬라이스 | 닿는 파일 수 |\n| --- | --- |\n${rows}\n\n바뀐 파일:\n\n${changedList}`;
}

function runAffected(baseRevision) {
  // 워킹트리와 비교한다 — CI에서는 PR 머지 커밋이 체크아웃돼 있어 PR의 변경과 같고, 로컬에서는
  // 커밋하기 전 변경까지 미리 볼 수 있다.
  const changedFiles = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=d', baseRevision, '--', 'src'],
    { cwd: ROOT, encoding: 'utf8' }
  )
    .split('\n')
    .filter(Boolean);
  const heading = '## 이 PR이 닿는 파일 (dependency-cruiser)';
  const graph = buildGraph(runDepcruise().modules);
  const changed = changedFiles.filter((file) => graph.has(file));

  if (changed.length === 0) {
    console.log(`${heading}\n\n그림 대상인 src 파일 변경이 없다(${EXCLUDED_DESCRIPTION}는 제외).`);
    return;
  }

  const reached = collectReachingModules(graph, changed);
  console.log(`${heading}\n\n${toAffectedMarkdown(graph, changed, reached)}`);
}

function main() {
  const [mode, value] = process.argv.slice(2);

  if (mode === '--reaches' && value) {
    runReaches(value);
    return;
  }

  if (mode === '--focus' && value) {
    runFocus(value);
    return;
  }

  if (mode === '--archi') {
    runArchi();
    return;
  }

  if (mode === '--affected' && value) {
    runAffected(value);
    return;
  }

  console.error(
    '사용법: pnpm graph <정규식>         예) pnpm graph "useClickGuard[.]ts$"  (거슬러 올라가 닿는 파일 전부)'
  );
  console.error(
    '        pnpm graph:focus <정규식>   예) pnpm graph:focus "ToggleButton"   (바로 이웃만)'
  );
  console.error(
    '        pnpm graph:archi                                               (슬라이스 단위 전체 구조)'
  );
  console.error(
    '        node scripts/dep-graph.js --affected <기준 커밋>                (CI의 PR 영향 그래프)'
  );
  process.exitCode = 1;
}

main();
