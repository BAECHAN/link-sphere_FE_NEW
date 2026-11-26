// 공용 UI 패키지의 토큰 원본에서 생성물 두 개를 만든다(2026-11-24, docs/plans/2026-11-24-design-tokens-stage2.md).
//
//   tokens/*.tokens.json (DTCG 2025.10 형식, 사람이 고친다)
//     -> src/styles/tokens.gen.css     Tailwind 테마 블록과 :root, .dark 변수
//     -> src/generated/tokens.gen.ts   카탈로그, 토큰 표 문서, cn()이 읽는 목록
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
//   - 블록 배치: Tailwind 4의 @theme 블록과 하위 키(--text-<이름>--line-height)는 내장 출력에 없다.
//   - 층 규칙: 의미 색은 값을 숫자로 적지 않고 팔레트를 가리킨다(2026-11-26 게이트 2, assertColorsUsePalette).
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
const GENERATED_NOTICE = [
  '생성 파일 - 직접 고치지 않는다.',
  '원본: packages/ui/tokens/*.tokens.json, 다시 만들기: 저장소 루트에서 pnpm tokens',
  '값과 이유를 정리한 표: docs/DESIGN-TOKENS.md',
];

function fail(id, message) {
  throw new Error(`[tokens] ${id}: ${message}`);
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

/** Style Dictionary 값 변환기. 별칭은 풀린 값으로 들어온다. 모르는 타입이나 모양이 틀린 값은 멈춘다. */
function toCssValue(token) {
  const id = token.path.join('.');
  const value = token.$value;

  switch (token.$type) {
    case 'color':
      return formatColor(id, value);
    case 'dimension':
      if (!isNumber(value?.value) || !DIMENSION_UNITS.includes(value.unit)) {
        fail(
          id,
          `크기는 { value: 숫자, unit: ${DIMENSION_UNITS.join(' | ')} }여야 한다(받은 값: ${JSON.stringify(value)})`
        );
      }

      return `${value.value}${value.unit}`;
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
      return { group, name: rest.join('-'), part: null };
    case 'radius':
    case 'z-index':
    case 'font-size':
    case 'line-height':
      return { group, name: rest[0], part: null };
    case 'text':
      return { group, name: rest[0], part: rest[1] };
    default:
      return fail(path.join('.'), '이름 규칙이 없는 축이다');
  }
}

/** 토큰 경로를 CSS 변수 이름으로 바꾼다. 색 이름은 shadcn/ui 관례대로 접두사가 없다(--primary). */
function cssVarName(path) {
  const { group, name, part } = describePath(path);

  switch (group) {
    case 'palette':
      return `--palette-${name}`;
    case 'color':
      return `--${name}`;
    case 'radius':
      return `--radius-${name}`;
    case 'z-index':
      return `--z-index-${name}`;
    case 'font-size':
      return `--text-${name}`;
    case 'line-height':
      return `--text-${name}--line-height`;
    default:
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

    return {
      id: token.path.join('.'),
      path: token.path,
      // CSS에 적는 값: 별칭이면 가리키는 변수, 아니면 값 그대로
      value: reference ? `var(${cssVarName(reference[1].split('.'))})` : token.$value,
      // 별칭을 끝까지 푼 값
      resolved: token.$value,
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

  assertColorsUsePalette(lightTree);
  assertColorsUsePalette(darkTree);

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
  const colors = inGroup('color');
  const lineHeights = new Map(inGroup('line-height').map((token) => [token.name, token]));

  // 블록마다 Tailwind 테마 옵션이 다르다.
  //   inline: 유틸리티가 --color-<이름>을 거치지 않고 var(--<이름>)을 바로 쓴다(:root, .dark의 값이 모드마다 바뀐다).
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
    [':root', [...inGroup('palette'), ...colors].map(line)],
    [
      '.dark',
      tokens
        .filter((token) => token.darkValue !== null)
        .map((token) => `  ${token.cssVar}: ${token.darkValue};`),
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
  const groupUnion = groups.map((group) => `'${group.id}'`).join(' | ');
  const json = (value) => JSON.stringify(value, null, 2);

  return `${GENERATED_NOTICE.map((text) => `// ${text}`).join('\n')}

/** 토큰 축. 원본 파일의 맨 위 그룹 이름이다. */
export type TokenGroup = ${groupUnion};

export interface DesignToken {
  /** 원본에서의 경로(점으로 이음) */
  id: string;
  group: TokenGroup;
  /** 축 안에서의 이름. Tailwind 클래스의 뒷부분이 된다(bg-primary의 primary, z-nav의 nav) */
  name: string;
  /** 글자 역할(text)에서만 값이 있다. 한 역할이 글자 크기, 줄 높이, 두께로 나뉜다 */
  part: 'font-size' | 'line-height' | 'font-weight' | null;
  cssVar: string;
  /** CSS에 적힌 값. 다른 토큰을 가리키면 var(--...)다 */
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

export const TOKENS = ${json(tokens)} as const satisfies readonly DesignToken[];

/** 글자 크기를 정하는 토큰 이름. cn()이 이 이름들을 글자 색이 아니라 글자 크기로 알아야 한다(lib/tailwind/utils.ts) */
export const TEXT_SIZE_TOKEN_NAMES = ${json(textSizeNames)} as const;
`;
}

const model = await buildModel();

mkdirSync(dirname(CSS_OUT), { recursive: true });
mkdirSync(dirname(TS_OUT), { recursive: true });
writeFileSync(CSS_OUT, renderCss(model));
writeFileSync(TS_OUT, renderTs(model));

console.log(`토큰 ${model.tokens.length}개: ${basename(CSS_OUT)}, ${basename(TS_OUT)}`);
