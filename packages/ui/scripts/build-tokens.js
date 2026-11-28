// 공용 UI 패키지의 토큰 원본에서 생성물 두 개를 만든다(2026-11-24, docs/plans/2026-11-24-design-tokens-stage2.md).
//
//   tokens/*.tokens.json (DTCG 2025.10 형식, 사람이 고친다)
//     -> src/styles/tokens.gen.css     Tailwind 테마 블록과 :root, .dark 변수
//     -> src/generated/tokens.gen.ts   카탈로그, 토큰 표 문서, cn()이 읽는 목록
//     -> src/recipes/<부품>.recipe.gen.ts  부품 토큰(tokens/components/)을 굳힌 Tailwind 클래스. 그 부품의 cva가 읽는다
//
// 실행은 저장소 루트의 `pnpm tokens`다(이 스크립트 -> prettier -> 토큰 표 문서). 생성물은 커밋하고, CI가 다시 만들어
// 커밋된 것과 같은지 본다(.github/workflows/ci.yml "토큰 생성물 최신성 확인").
//
// Style Dictionary가 맡는 것: 별칭 풀기(끊긴 별칭이면 멈춘다), 토큰마다 값 변환기 부르기.
// 이 스크립트가 맡는 것(Style Dictionary 5.8.0에 없거나 기본 동작이 우리와 달라서, 2026-11-24·25 시험):
//   - 라이트, 다크 구분: 모드 파일(tokens.resolver.json)을 읽지 못한다. 이 스크립트가 읽어 두 번 빌드한다.
//   - 파일 합치기: 파일 여러 개를 주면 같은 토큰을 속성 단위로 깊게 합친다. 다크 토큰에 라이트의 설명이 딸려 왔고,
//     같은 방식이면 라이트의 알파도 섞인다. 아래 addToTree가 토큰을 통째로 바꿔 한 나무로 만든 뒤 넘긴다.
//   - 값을 CSS 글자로: 기본 변환(css 묶음)은 색을 hex로 바꾼다. 패키지 색 6개가 sRGB 밖이라 그러면 넓은 색역 화면에서
//     색이 달라진다. oklch()를 원본 숫자 그대로 적는다.
//   - 값 모양 확인: 타입과 안 맞는 값(숫자 자리에 "50px")을 그대로 통과시킨다. 아래 toCssValue가 직접 본다.
//   - 오류 문구: 끊긴 별칭이나 변환 실패를 개수로만 알린다("참조 1개를 찾지 못함"). 어느 토큰인지는 이 스크립트가
//     댄다(assertReferencesExist, resolveTree의 valueErrors).
//   - 블록 배치: Tailwind 4의 @theme 블록과 하위 키(--text-<이름>--line-height)는 내장 출력에 없다. Tailwind 기본 시간·곡선이
//     토큰을 가리키게 하는 줄(TAILWIND_DEFAULTS)도 여기서 더한다.
//   - 층 규칙: 의미 색은 값을 숫자로 적지 않고 팔레트를 가리킨다(2026-11-26 게이트 2, assertColorsUsePalette). 옛 shadcn
//     이름은 의미 색이나 팔레트를 가리킨다(2026-11-27 게이트 3, assertShadcnUsesColor). 부품 토큰의 색은 의미 색(아직
//     값이 다른 옛 이름 포함)을 가리킨다(2026-11-28 게이트 4, assertComponentsUseSemantic).
//   - 다크의 별칭: 다크 파일에 없는 별칭도 가리키는 토큰이 다크에서 바뀌면 .dark에 같은 값을 한 번 더 적는다. CSS 변수 안의
//     var()는 그 변수를 적은 요소에서 풀려, :root에만 적으면 안쪽 요소에 붙은 .dark를 따르지 못한다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import StyleDictionary from 'style-dictionary';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS_DIR = join(PACKAGE_ROOT, 'tokens');
const CSS_OUT = join(PACKAGE_ROOT, 'src/styles/tokens.gen.css');
const TS_OUT = join(PACKAGE_ROOT, 'src/generated/tokens.gen.ts');

const REFERENCE = /^\{([^}]+)\}$/;
const DIMENSION_UNITS = ['rem', 'px'];
const DURATION_UNITS = { ms: 1, s: 1000 };
// 그림자 층의 크기 네 개. CSS box-shadow에 적는 순서다
const SHADOW_LENGTHS = ['offsetX', 'offsetY', 'blur', 'spread'];
// Tailwind가 시간·곡선 클래스 없이 transition만 붙은 곳에 쓰는 기본값의 변수다. 토큰을 가리키게 해서 그런 곳도 토큰 값을
// 따르게 한다(2026-11-26 게이트 2). 덮어쓰기 전 값은 Tailwind 4.3.5 theme.css의 150ms, cubic-bezier(0.4, 0, 0.2, 1)이다.
const TAILWIND_DEFAULTS = [
  { cssVar: '--default-transition-duration', token: 'duration.color-transition' },
  { cssVar: '--default-transition-timing-function', token: 'timing-function.easing' },
];
// 부품 토큰 축(tokens/components/<이름>.tokens.json의 맨 위 그룹). CSS 변수를 만들지 않고 src/recipes/<이름>.recipe.gen.ts에
// Tailwind 클래스로 굳힌다(당근식, 2026-11-28 게이트 4). 레시피는 Tailwind가 훑는 곳이어야 해서 src/generated에 두지 않는다
const COMPONENTS = ['button'];
const RECIPE_DIR = join(PACKAGE_ROOT, 'src/recipes');
// 별칭에 투명도를 붙이는 확장. DTCG 2025.10에는 "별칭 + 투명도" 꼴이 없다
const ALPHA_EXTENSION = 'baechan.ui';
// 토큰 모델에서 부품 레시피만 읽고 TS 생성물에는 싣지 않는 칸
const RECIPE_ONLY_FIELDS = ['raw', 'reference', 'alpha', 'dark', 'type'];
const GENERATED_NOTICE = [
  '생성 파일 - 직접 고치지 않는다.',
  '원본: packages/ui/tokens/*.tokens.json, 다시 만들기: 저장소 루트에서 pnpm tokens',
  '값과 이유를 정리한 표: docs/DESIGN-TOKENS.md',
];

function fail(id, message) {
  throw new Error(`[tokens] ${id}: ${message}`);
}

/** 0~1 투명도를 백분율 숫자로(0.7 * 100이 70.00000000000001이 되는 부동소수 오차를 없앤다). */
function toPercent(ratio) {
  return Math.round(ratio * 1000) / 10;
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** DTCG 색 객체를 `oklch(L C H)` 또는 `oklch(L C H / A%)`로 적는다. 숫자는 원본 그대로다. */
function formatColor(id, value) {
  if (value?.colorSpace !== 'oklch') {
    fail(id, `색 공간은 oklch만 받는다(받은 값: ${JSON.stringify(value)})`);
  }

  if (
    !Array.isArray(value.components) ||
    value.components.length !== 3 ||
    !value.components.every(isNumber)
  ) {
    fail(id, `색 성분은 숫자 3개여야 한다(받은 값: ${JSON.stringify(value.components)})`);
  }

  const body = value.components.join(' ');

  if (value.alpha === undefined || value.alpha === 1) {
    return `oklch(${body})`;
  }

  if (!isNumber(value.alpha) || value.alpha < 0 || value.alpha > 1) {
    fail(id, `알파는 0과 1 사이 숫자여야 한다(받은 값: ${JSON.stringify(value.alpha)})`);
  }

  return `oklch(${body} / ${Number((value.alpha * 100).toFixed(4))}%)`;
}

/** DTCG 크기 객체를 `<숫자><단위>`로 적는다. */
function formatDimension(id, value) {
  if (!isNumber(value?.value) || !DIMENSION_UNITS.includes(value.unit)) {
    fail(
      id,
      `크기는 { value: 숫자, unit: ${DIMENSION_UNITS.join(' | ')} }여야 한다(받은 값: ${JSON.stringify(value)})`
    );
  }

  return `${value.value}${value.unit}`;
}

/** DTCG 그림자 층 하나를 `<가로> <세로> <흐림> <퍼짐> <색>`으로 적는다. 안쪽 그림자(inset)는 쓰는 곳이 없어 받지 않는다. */
function formatShadowLayer(id, layer) {
  if (layer?.inset !== undefined) {
    fail(id, '안쪽 그림자(inset)는 받지 않는다');
  }

  if (layer?.blur?.value < 0) {
    fail(id, `흐림(blur)은 0 이상이어야 한다(받은 값: ${JSON.stringify(layer.blur)})`);
  }

  const lengths = SHADOW_LENGTHS.map((key) => formatDimension(`${id}.${key}`, layer?.[key]));

  return `${lengths.join(' ')} ${formatColor(`${id}.color`, layer.color)}`;
}

/** Style Dictionary 값 변환기. 별칭은 풀린 값으로 들어온다. 모르는 타입이나 모양이 틀린 값은 멈춘다. */
function toCssValue(token) {
  const id = token.path.join('.');
  const value = token.$value;

  switch (token.$type) {
    case 'color':
      return formatColor(id, value);
    case 'dimension':
      return formatDimension(id, value);
    case 'shadow':
      // DTCG 형식: 층 객체의 배열(앞의 층이 위에 그려진다). 층 하나짜리 객체 꼴은 받지 않고 배열로 적게 한다
      if (!Array.isArray(value) || value.length === 0) {
        fail(id, `그림자는 층 객체의 배열이어야 한다(받은 값: ${JSON.stringify(value)})`);
      }

      return value.map((layer, index) => formatShadowLayer(`${id}[${index}]`, layer)).join(', ');
    case 'duration':
      if (!isNumber(value?.value) || value.value < 0 || !(value.unit in DURATION_UNITS)) {
        fail(
          id,
          `시간은 { value: 0 이상 숫자, unit: ${Object.keys(DURATION_UNITS).join(' | ')} }여야 한다(받은 값: ${JSON.stringify(value)})`
        );
      }

      return `${value.value}${value.unit}`;
    case 'cubicBezier': {
      // DTCG 형식: [P1x, P1y, P2x, P2y]. x는 0과 1 사이다(CSS cubic-bezier()도 같은 범위만 받는다)
      const isCurve =
        Array.isArray(value) &&
        value.length === 4 &&
        value.every(isNumber) &&
        [value[0], value[2]].every((x) => x >= 0 && x <= 1);

      if (!isCurve) {
        fail(
          id,
          `곡선은 숫자 4개 [x1, y1, x2, y2]이고 x는 0과 1 사이여야 한다(받은 값: ${JSON.stringify(value)})`
        );
      }

      return `cubic-bezier(${value.join(', ')})`;
    }
    case 'number':
    case 'fontWeight':
      if (!isNumber(value)) {
        fail(id, `${token.$type} 값은 숫자여야 한다(받은 값: ${JSON.stringify(value)})`);
      }

      return String(value);
    default:
      return fail(id, `변환 규칙이 없는 타입이다: ${token.$type}`);
  }
}

/** 토큰 경로를 축(group), 축 안의 이름(name), 글자 역할의 부분(part)으로 나눈다. */
function describePath(path) {
  const [group, ...rest] = path;

  switch (group) {
    case 'palette':
    case 'color':
    case 'shadcn':
      return { group, name: rest.join('-'), part: null };
    case 'radius':
    case 'z-index':
    case 'font-size':
    case 'line-height':
    case 'duration':
    case 'timing-function':
    case 'shadow':
    case 'spacing':
      return { group, name: rest[0], part: null };
    case 'text':
      return { group, name: rest[0], part: rest[1] };
    default:
      if (COMPONENTS.includes(group)) {
        return { group, name: rest.join('-'), part: null };
      }

      return fail(path.join('.'), '이름 규칙이 없는 축이다');
  }
}

/**
 * 토큰 경로를 CSS 변수 이름으로 바꾼다. 팔레트와 의미 색은 --bui-color-를 붙인다. 이 패키지를 쓰는 앱의 다른 전역 변수와
 * 겹치지 않게 하려는 것이다(2026-11-27 게이트 3). 옛 shadcn 이름은 쓰는 곳이 그대로 동작하게 예전처럼 접두사가 없다(--primary).
 */
function cssVarName(path) {
  const { group, name, part } = describePath(path);

  switch (group) {
    case 'palette':
      return `--bui-color-palette-${name}`;
    case 'color':
      return `--bui-color-${name}`;
    case 'shadcn':
      return `--${name}`;
    case 'radius':
      return `--radius-${name}`;
    case 'z-index':
      return `--z-index-${name}`;
    case 'font-size':
      return `--text-${name}`;
    case 'line-height':
      return `--text-${name}--line-height`;
    // Tailwind 4.3.5의 duration-<이름>, ease-<이름>이 읽는 테마 키다(dist/lib.js. src/test/tailwind-motion-theme.test.ts가 확인)
    case 'duration':
      return `--transition-duration-${name}`;
    case 'timing-function':
      return `--ease-${name}`;
    // Tailwind의 shadow-<이름>이 읽는 테마 키다(src/test/tailwind-shadow-theme.test.ts가 확인)
    case 'shadow':
      return `--shadow-${name}`;
    // Tailwind 문서의 간격 이름공간이다. gap-<이름>을 비롯한 간격·크기 유틸리티가 읽는다
    // (src/test/tailwind-spacing-theme.test.ts가 확인)
    case 'spacing':
      return `--spacing-${name}`;
    default:
      if (COMPONENTS.includes(group)) {
        return `--bui-${group}-${name}`;
      }

      return part === 'font-size' ? `--text-${name}` : `--text-${name}--${part}`;
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(join(TOKENS_DIR, file), 'utf8'));
}

/** 모드 파일에서 기본(라이트) 파일 목록과 다크에서 덮어쓰는 파일 목록을 읽는다. */
function readFileLists() {
  const resolver = readJson('tokens.resolver.json');
  const toFiles = (sources) => sources.map((source) => source.$ref);

  return {
    base: toFiles(resolver.sets.base.sources),
    dark: toFiles(resolver.modifiers.theme.contexts.dark),
  };
}

/** `$value`를 가진 객체가 토큰이고, 나머지 객체는 토큰을 묶는 그룹이다. */
function isToken(node) {
  return typeof node === 'object' && node !== null && '$value' in node;
}

/**
 * 원본 파일 하나를 토큰 나무에 더한다. 토큰은 통째로 놓는다(속성 단위로 합치지 않는다).
 *   override가 false(기본 파일끼리): 같은 토큰이 앞 파일에 있으면 실수이므로 멈춘다.
 *   override가 true(다크 파일): 기본 파일에 있는 토큰만 바꾼다. 다크에만 있는 토큰은 라이트 값이 없어 멈춘다.
 */
function addToTree(tree, source, { override, file, path = [] }) {
  for (const [key, node] of Object.entries(source)) {
    const id = [...path, key].join('.');

    if (key.startsWith('$')) {
      // 그룹에 붙은 설명. 다크 파일의 것은 쓰지 않는다.
      if (!override) {
        tree[key] = node;
      }

      continue;
    }

    if (!isToken(node)) {
      if (isToken(tree[key]) || (override && !(key in tree))) {
        fail(id, `${file}의 그룹이 기본 파일의 구조와 다르다`);
      }

      tree[key] ??= {};
      addToTree(tree[key], node, { override, file, path: [...path, key] });

      continue;
    }

    if (override && !isToken(tree[key])) {
      fail(id, `${file}에만 있는 토큰이다. 기본 파일에 먼저 둔다`);
    }

    if (!override && key in tree) {
      fail(id, `${file}의 토큰이 앞 파일에 이미 있다`);
    }

    tree[key] = node;
  }
}

/** 나무에 든 토큰을 [경로(점으로 이음), 토큰] 짝으로 모은다. */
function listTokens(tree, path = []) {
  return Object.entries(tree).flatMap(([key, node]) => {
    if (key.startsWith('$')) {
      return [];
    }

    return isToken(node) ? [[[...path, key].join('.'), node]] : listTokens(node, [...path, key]);
  });
}

/** 별칭이 가리키는 토큰이 나무에 있는지 본다. Style Dictionary도 멈추지만 어느 토큰인지 알려 주지 않는다. */
function assertReferencesExist(tree) {
  const tokensById = new Map(listTokens(tree));

  for (const [id, token] of tokensById) {
    const reference = typeof token.$value === 'string' ? token.$value.match(REFERENCE) : null;

    if (reference && !tokensById.has(reference[1])) {
      fail(id, `가리키는 토큰이 없다: ${token.$value}`);
    }
  }
}

/** 의미 색(color)이 모두 팔레트(palette)를 가리키는지 본다. 숫자 값이나 다른 축을 가리키는 값이면 멈춘다. */
function assertColorsUsePalette(tree) {
  for (const [id, token] of listTokens(tree)) {
    const reference = typeof token.$value === 'string' ? token.$value.match(REFERENCE) : null;

    if (id.startsWith('color.') && !reference?.[1].startsWith('palette.')) {
      fail(
        id,
        `의미 색은 값을 직접 적지 않고 팔레트를 가리킨다(예: {palette.gray.900}, 받은 값: ${JSON.stringify(token.$value)}). 필요한 값이 없으면 palette.tokens.json에 먼저 더한다`
      );
    }
  }
}

/** 옛 shadcn 이름(shadcn)이 모두 의미 색이나 팔레트를 가리키는지 본다. 값을 직접 적으면 멈춘다. */
function assertShadcnUsesColor(tree) {
  for (const [id, token] of listTokens(tree)) {
    const reference = typeof token.$value === 'string' ? token.$value.match(REFERENCE) : null;
    const target = reference?.[1] ?? '';

    if (id.startsWith('shadcn.') && !/^(color|palette)\./.test(target)) {
      fail(
        id,
        `옛 shadcn 이름은 값을 직접 적지 않고 의미 색을 가리킨다(예: {color.bg.layer-basement}, 받은 값: ${JSON.stringify(token.$value)})`
      );
    }
  }
}

/** 부품 토큰의 색이 의미 색이나 옛 shadcn 이름을 가리키는지 본다. 팔레트를 바로 가리키거나 값을 직접 적으면 멈춘다. */
function assertComponentsUseSemantic(tree) {
  for (const [id, token] of listTokens(tree)) {
    const reference = typeof token.$value === 'string' ? token.$value.match(REFERENCE) : null;
    const isComponent = COMPONENTS.some((name) => id.startsWith(`${name}.`));

    if (isComponent && token.$type === 'color' && !/^(color|shadcn)\./.test(reference?.[1] ?? '')) {
      fail(id, `부품 토큰의 색은 의미 색을 가리킨다(받은 값: ${JSON.stringify(token.$value)})`);
    }
  }
}

/** 토큰 나무를 Style Dictionary에 넘겨 별칭을 풀고 토큰마다 CSS 값을 낸다. */
async function resolveTree(tree) {
  assertReferencesExist(tree);

  // Style Dictionary는 변환기가 던진 오류를 "변환 N개 실패"로만 알린다. 어느 토큰이 왜 틀렸는지는 여기 모아 다시 던진다.
  const valueErrors = [];
  const dictionary = new StyleDictionary(
    {
      // 넘겨받은 객체를 Style Dictionary가 고칠 수 있어 사본을 준다(같은 나무로 다크를 한 번 더 만든다).
      tokens: structuredClone(tree),
      usesDtcg: true,
      log: { warnings: 'error', verbosity: 'silent' },
      hooks: {
        transforms: {
          'ui/css-value': {
            type: 'value',
            filter: () => true,
            transform: (token) => {
              try {
                return toCssValue(token);
              } catch (error) {
                valueErrors.push(error.message);

                throw error;
              }
            },
          },
        },
      },
      platforms: { css: { transforms: ['ui/css-value'] } },
    },
    { verbosity: 'silent' }
  );
  let allTokens;

  try {
    ({ allTokens } = await dictionary.getPlatformTokens('css'));
  } catch (error) {
    if (valueErrors.length > 0) {
      throw new Error(valueErrors.join('\n'), { cause: error });
    }

    throw error;
  }

  return allTokens.map((token) => {
    const original = token.original.$value;
    const reference = typeof original === 'string' ? original.match(REFERENCE) : null;
    const alpha = token.original.$extensions?.[ALPHA_EXTENSION]?.alpha ?? null;
    const referenceVar = reference ? `var(${cssVarName(reference[1].split('.'))})` : null;

    if (alpha !== null && !reference) {
      fail(token.path.join('.'), '투명도 확장은 별칭에만 붙인다');
    }

    return {
      id: token.path.join('.'),
      path: token.path,
      // CSS에 적는 값: 별칭이면 가리키는 변수(투명도가 있으면 Tailwind의 /<투명도>와 같은 color-mix), 아니면 값 그대로
      value:
        alpha !== null
          ? `color-mix(in oklab, ${referenceVar} ${toPercent(alpha)}%, transparent)`
          : (referenceVar ?? token.$value),
      // 별칭을 끝까지 푼 값
      resolved: alpha !== null ? `${token.$value} / ${alpha}` : token.$value,
      // 별칭이 아닌 원본 값(DTCG 객체·숫자). 부품 레시피가 Tailwind 눈금 클래스로 바꿀 때 읽는다
      raw: reference ? null : original,
      reference: reference?.[1] ?? null,
      alpha,
      type: token.$type,
      description: token.$description ?? null,
    };
  });
}

async function buildModel() {
  const files = readFileLists();
  const lightTree = {};

  for (const file of files.base) {
    addToTree(lightTree, readJson(file), { override: false, file });
  }

  const darkTree = structuredClone(lightTree);
  const declaredInDark = new Set();

  for (const file of files.dark) {
    const source = readJson(file);

    addToTree(darkTree, source, { override: true, file });
    listTokens(source).forEach(([id]) => declaredInDark.add(id));
  }

  for (const tree of [lightTree, darkTree]) {
    assertColorsUsePalette(tree);
    assertShadcnUsesColor(tree);
    assertComponentsUseSemantic(tree);
  }

  const light = await resolveTree(lightTree);
  const darkById = new Map((await resolveTree(darkTree)).map((token) => [token.id, token]));

  const tokens = light.map((token) => {
    const inDark = darkById.get(token.id);
    const isDeclaredInDark = declaredInDark.has(token.id);

    return {
      id: token.id,
      ...describePath(token.path),
      cssVar: cssVarName(token.path),
      value: token.value,
      resolved: token.resolved,
      // 다크 파일에 적혀 있을 때만 값이 있다. 적혀 있지 않아도 가리키는 토큰이 바뀌면 darkResolved는 달라질 수 있다.
      darkValue: isDeclaredInDark ? inDark.value : null,
      darkResolved: inDark.resolved,
      // 아래 다섯 개는 부품 레시피만 읽는다(RECIPE_ONLY_FIELDS)
      raw: token.raw,
      reference: token.reference,
      alpha: token.alpha,
      dark: isDeclaredInDark
        ? { raw: inDark.raw, reference: inDark.reference, alpha: inDark.alpha }
        : null,
      type: token.type,
      description: token.description,
      darkDescription: isDeclaredInDark ? inDark.description : null,
    };
  });

  // Style Dictionary는 그룹 설명을 토큰에 싣지 않아 나무에서 직접 읽는다.
  const groups = Object.entries(lightTree).map(([id, group]) => ({
    id,
    description: group.$description ?? null,
  }));

  return { tokens, groups };
}

function renderCss({ tokens }) {
  const inGroup = (group) => tokens.filter((token) => token.group === group);
  const line = (token) => `  ${token.cssVar}: ${token.value};`;
  const colors = [...inGroup('color'), ...inGroup('shadcn')];
  // 부품 토큰은 CSS 변수로 내보내지 않는다(레시피로 굳힌다)
  const cssTokens = tokens.filter((token) => !COMPONENTS.includes(token.group));
  const lineHeights = new Map(inGroup('line-height').map((token) => [token.name, token]));
  // 시간·곡선 축의 토큰 뒤에, 그 축을 가리키는 Tailwind 기본값 줄을 붙인다
  const withTailwindDefaults = (group) => [
    ...inGroup(group).map(line),
    ...TAILWIND_DEFAULTS.filter(({ token }) => token.startsWith(`${group}.`)).map(
      ({ cssVar, token: id }) => {
        const token = tokens.find((candidate) => candidate.id === id);

        if (!token) {
          fail(id, `${cssVar}가 가리킬 토큰이 없다`);
        }

        return `  ${cssVar}: var(${token.cssVar});`;
      }
    ),
  ];

  // 블록마다 Tailwind 테마 옵션이 다르다.
  //   inline: 유틸리티가 --color-<이름>을 거치지 않고 토큰 변수(var(--bui-color-fg-neutral), var(--primary))를 바로 쓴다
  //   (:root, .dark의 값이 모드마다 바뀐다).
  //   static: 쓰는 곳이 없어도 변수를 출력한다. Storybook 토큰 카탈로그가 변수 값을 읽어 그린다.
  //   (옵션 없음): 클래스로 쓰일 때만 변수와 유틸리티가 나온다. 글자 역할은 모두 클래스로 쓴다.
  const blocks = [
    ['@theme inline', colors.map((token) => `  --color-${token.name}: var(${token.cssVar});`)],
    ['@theme static', inGroup('radius').map(line)],
    ['@theme static', inGroup('z-index').map(line)],
    [
      '@theme static',
      inGroup('font-size').flatMap((size) => {
        const lineHeight = lineHeights.get(size.name);

        if (!lineHeight) {
          fail(size.id, 'line-height에 같은 이름의 짝이 없다');
        }

        return [line(size), line(lineHeight)];
      }),
    ],
    ['@theme', inGroup('text').map(line)],
    // 시간·곡선도 static이다. 기본값 줄이 가리키는 변수(color-transition 등)는 그 이름의 클래스를 쓰는 곳이 없어도 있어야 한다
    ['@theme static', withTailwindDefaults('duration')],
    ['@theme static', withTailwindDefaults('timing-function')],
    // 그림자도 static이다. shadow-<이름>은 변수를 가리키지 않고 값을 규칙에 그대로 넣어, 옵션이 없으면 변수가 출력에서 빠진다
    ['@theme static', inGroup('shadow').map(line)],
    // 간격도 static이다. 카탈로그가 클래스 없이 변수로 견본을 그린다
    ['@theme static', inGroup('spacing').map(line)],
    [':root', [...inGroup('palette'), ...colors].map(line)],
    [
      '.dark',
      cssTokens.flatMap((token) => {
        if (token.darkValue !== null) {
          return [`  ${token.cssVar}: ${token.darkValue};`];
        }

        // 다크 파일에 없지만 가리키는 토큰이 다크에서 바뀌는 별칭(맨 위 주석 "다크의 별칭")
        return token.darkResolved === token.resolved ? [] : [line(token)];
      }),
    ],
  ];
  const header = `/*\n${GENERATED_NOTICE.map((text) => ` * ${text}`).join('\n')}\n */`;
  const body = blocks.map(([selector, lines]) => `${selector} {\n${lines.join('\n')}\n}`);

  return `${[header, ...body].join('\n\n')}\n`;
}

function renderTs({ tokens, groups }) {
  const textSizeNames = tokens
    .filter(
      (token) =>
        token.group === 'font-size' || (token.group === 'text' && token.part === 'font-size')
    )
    .map((token) => token.name);
  const durationNames = tokens
    .filter((token) => token.group === 'duration')
    .map((token) => token.name);
  const easeNames = tokens
    .filter((token) => token.group === 'timing-function')
    .map((token) => token.name);
  const shadowNames = tokens.filter((token) => token.group === 'shadow').map((token) => token.name);
  const spacingNames = tokens
    .filter((token) => token.group === 'spacing')
    .map((token) => token.name);
  const durationMs = Object.fromEntries(
    tokens
      .filter((token) => token.group === 'duration')
      .map((token) => {
        const [, amount, unit] = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(token.resolved);

        return [token.name, Number(amount) * DURATION_UNITS[unit]];
      })
  );
  const groupUnion = groups.map((group) => `'${group.id}'`).join(' | ');
  const json = (value) => JSON.stringify(value, null, 2);

  return `${GENERATED_NOTICE.map((text) => `// ${text}`).join('\n')}

/** 토큰 축. 원본 파일의 맨 위 그룹 이름이다. */
export type TokenGroup = ${groupUnion};

export interface DesignToken {
  /** 원본에서의 경로(점으로 이음) */
  id: string;
  group: TokenGroup;
  /** 축 안에서의 이름. Tailwind 클래스의 뒷부분이 된다(의미 색 fg-neutral, 옛 이름 primary, z-nav의 nav) */
  name: string;
  /** 글자 역할(text)에서만 값이 있다. 한 역할이 글자 크기, 줄 높이, 두께로 나뉜다 */
  part: 'font-size' | 'line-height' | 'font-weight' | null;
  /** 부품 토큰(${COMPONENTS.join(', ')})은 CSS로 내보내지 않아 이 변수가 없다. 레시피(src/recipes)의 클래스로만 쓴다 */
  cssVar: string;
  /** CSS에 적힌 값(부품 토큰은 CSS에 적히지 않고 같은 꼴로만 적는다). 다른 토큰을 가리키면 var(--...)다 */
  value: string;
  /** 가리키는 토큰을 끝까지 따라간 값 */
  resolved: string;
  /** 다크에서 다시 정한 값. 다시 정하지 않았으면 null */
  darkValue: string | null;
  /** 다크에서의 최종 값. 다시 정하지 않았으면 resolved와 같다 */
  darkResolved: string;
  description: string | null;
  /** 다크에서 다시 정한 값에 따로 붙은 설명 */
  darkDescription: string | null;
}

export const TOKEN_GROUPS = ${json(groups)} as const satisfies readonly {
  id: TokenGroup;
  description: string | null;
}[];

export const TOKENS = ${json(
    tokens.map((token) =>
      Object.fromEntries(Object.entries(token).filter(([key]) => !RECIPE_ONLY_FIELDS.includes(key)))
    )
  )} as const satisfies readonly DesignToken[];

/** 글자 크기를 정하는 토큰 이름. cn()이 이 이름들을 글자 색이 아니라 글자 크기로 알아야 한다(lib/tailwind/utils.ts) */
export const TEXT_SIZE_TOKEN_NAMES = ${json(textSizeNames)} as const;

/** 시간·곡선 토큰 이름. cn()이 duration-<이름>, ease-<이름>을 같은 묶음으로 알아야 뒤에 온 클래스가 앞의 것을 덮는다 */
export const DURATION_TOKEN_NAMES = ${json(durationNames)} as const;
export const EASE_TOKEN_NAMES = ${json(easeNames)} as const;

/** 그림자 토큰 이름. cn()이 shadow-<이름>을 그림자 색이 아니라 그림자로 알아야 한다(lib/tailwind/utils.ts) */
export const SHADOW_TOKEN_NAMES = ${json(shadowNames)} as const;

/** 역할 간격 토큰 이름. cn()이 gap-<이름>을 간격으로 알아야 앞의 숫자 간격을 덮는다(lib/tailwind/utils.ts) */
export const SPACING_TOKEN_NAMES = ${json(spacingNames)} as const;

/** 시간 토큰의 밀리초 값. CSS 전환이 끝나기를 기다리는 JS 타이머가 읽는다(같은 시간을 숫자로 따로 적지 않으려고) */
export const DURATION_MS = ${json(durationMs)} as const;
`;
}

// 부품 레시피: 부품 토큰의 속성 이름 -> Tailwind 유틸리티. 상태 꼬리(-hover, -with-icon)는 앞에 붙는 변형이 된다.
// 새 부품에 없는 속성이 나오면 여기에 한 줄 더한다(없으면 멈춘다)
const STATIC_UTILITIES = {
  background: { utility: 'bg' },
  foreground: { utility: 'text' },
  'border-color': { utility: 'border' },
  'border-width': { utility: 'border' },
  'focus-ring': { utility: 'ring', prefix: 'focus-visible:' },
  shadow: { utility: 'shadow' },
  radius: { utility: 'rounded' },
  'font-size': { utility: 'text' },
  'line-height': { utility: 'leading' },
  'font-weight': { utility: 'font' },
  gap: { utility: 'gap', scale: true },
  height: { utility: 'h', scale: true },
  square: { utility: 'size', scale: true },
  'padding-x': { utility: 'px', scale: true },
  'padding-y': { utility: 'py', scale: true },
  'icon-size': { utility: 'size', prefix: "[&_svg:not([class*='size-'])]:", scale: true },
  'disabled-opacity': { utility: 'opacity', prefix: 'disabled:' },
};
const STATE_PREFIXES = { hover: 'hover:', 'with-icon': 'has-[>svg]:' };
// Tailwind 4의 이름 붙은 글자 두께(theme.css --font-weight-*)
const FONT_WEIGHT_NAMES = { 400: 'normal', 500: 'medium', 600: 'semibold', 700: 'bold' };

/** 부품 토큰 하나를 Tailwind 클래스 하나로 굳힌다. 다크 값이면 dark: 변형을 붙인다. */
function toStaticClass(token, { dark }) {
  const property = token.id.split('.').at(-1);
  const state = Object.keys(STATE_PREFIXES).find((name) => property.endsWith(`-${name}`));
  const base = state ? property.slice(0, -(state.length + 1)) : property;
  const rule =
    STATIC_UTILITIES[base] ?? fail(token.id, `클래스로 바꿀 규칙이 없는 속성이다: ${base}`);
  const { raw, reference, alpha } = dark ? token.dark : token;
  let suffix;

  if (reference) {
    // 의미 색 fg.neutral은 Tailwind 색 이름 fg-neutral, 반경 radius.md는 md다(cssVarName의 이름과 같다)
    suffix = describePath(reference.split('.')).name;
    suffix += alpha === null ? '' : `/${toPercent(alpha)}`;
  } else if (token.type === 'dimension') {
    const { value, unit } = raw;

    if (base === 'border-width' && value === 1 && unit === 'px') {
      suffix = null;
    } else if (rule.scale && unit === 'rem' && Number.isInteger(value * 8)) {
      // Tailwind 간격 눈금(--spacing 0.25rem의 배수, 0.5 단위까지)
      suffix = String(value * 4);
    } else {
      suffix = `[${value}${unit}]`;
    }
  } else if (token.type === 'fontWeight') {
    suffix = FONT_WEIGHT_NAMES[raw] ?? `[${raw}]`;
  } else if (token.type === 'number') {
    suffix = String(toPercent(raw));
  } else {
    fail(token.id, `클래스로 바꿀 규칙이 없는 값이다: ${token.type}`);
  }

  const prefixes = `${dark ? 'dark:' : ''}${state ? STATE_PREFIXES[state] : ''}${rule.prefix ?? ''}`;

  return `${prefixes}${rule.utility}${suffix === null ? '' : `-${suffix}`}`;
}

/** 부품 레시피 파일. base는 문자열, variant·size는 이름별 문자열이다. */
function renderRecipe(component, tokens) {
  const recipe = {};

  for (const token of tokens.filter((candidate) => candidate.group === component)) {
    const [, section, ...rest] = token.id.split('.');
    const key = section === 'base' ? null : rest[0];
    const classes = [toStaticClass(token, { dark: false })];

    if (token.dark !== null) {
      classes.push(toStaticClass(token, { dark: true }));
    }

    if (key === null) {
      recipe[section] = [...(recipe[section] ?? []), ...classes];
    } else {
      recipe[section] ??= {};
      recipe[section][key] = [...(recipe[section][key] ?? []), ...classes];
    }
  }

  const join = (value) =>
    Array.isArray(value)
      ? value.join(' ')
      : Object.fromEntries(Object.entries(value).map(([key, list]) => [key, list.join(' ')]));
  const body = Object.fromEntries(Object.entries(recipe).map(([key, value]) => [key, join(value)]));
  const constName = `${component.toUpperCase().replaceAll('-', '_')}_RECIPE`;

  return `${GENERATED_NOTICE.map((text) => `// ${text}`).join('\n')}

/** ${component} 부품 토큰을 Tailwind 클래스로 굳힌 것. 부품의 cva가 읽는다 */
export const ${constName} = ${JSON.stringify(body, null, 2)} as const;
`;
}

const model = await buildModel();

mkdirSync(dirname(CSS_OUT), { recursive: true });
mkdirSync(dirname(TS_OUT), { recursive: true });
mkdirSync(RECIPE_DIR, { recursive: true });
writeFileSync(CSS_OUT, renderCss(model));
writeFileSync(TS_OUT, renderTs(model));

for (const component of COMPONENTS) {
  writeFileSync(
    join(RECIPE_DIR, `${component}.recipe.gen.ts`),
    renderRecipe(component, model.tokens)
  );
}

console.log(
  `토큰 ${model.tokens.length}개: ${basename(CSS_OUT)}, ${basename(TS_OUT)}, 부품 레시피 ${COMPONENTS.length}개`
);
