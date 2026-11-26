// 토큰 표 문서(docs/DESIGN-TOKENS.md)를 만든다. 재료는 공용 UI 패키지의 생성된 토큰 목록
// (packages/ui/src/generated/tokens.gen.ts)이고, 그 목록은 packages/ui/tokens/의 원본에서 나온다.
//
// 혼자 돌리지 않는다. `pnpm tokens`가 패키지 생성 → 서식 → 이 스크립트 순으로 부른다(혼자 돌리면 낡은
// 목록을 읽을 수 있다). 문서를 직접 고치면 CI "토큰 생성물 최신성 확인"이 막는다.
//
// .ts 파일을 그대로 import한다. Node 24는 타입 표기를 지우고 읽는다
// (https://nodejs.org/api/typescript.html#type-stripping).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import * as prettier from 'prettier';

import { TOKEN_GROUPS, TOKENS } from '../packages/ui/src/generated/tokens.gen.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = 'docs/DESIGN-TOKENS.md';
const SOURCE_DIR = 'packages/ui/tokens';
const ROOT_FONT_SIZE_PX = 16;
const SAME_AS_LIGHT = '라이트와 같음';

/** 문서의 절. 축(원본의 맨 위 그룹)이 여기 없으면 실패한다 - 축을 더하면 어떤 표로 보일지 정해야 한다. */
const SECTIONS = [
  { title: '팔레트', groups: ['palette'], render: renderPaletteTable },
  { title: '의미 색', groups: ['color'], render: renderColorTable },
  {
    title: '반경',
    groups: ['radius'],
    render: (tokens) => renderSingleValueTable(tokens, 'rounded-'),
  },
  {
    title: '겹침 순서',
    groups: ['z-index'],
    render: (tokens) => renderSingleValueTable(tokens, 'z-'),
  },
  { title: '글자 크기 눈금', groups: ['font-size', 'line-height'], render: renderScaleTable },
  { title: '글자 역할', groups: ['text'], render: renderRoleTable },
  {
    title: '시간',
    groups: ['duration'],
    render: (tokens) => renderSingleValueTable(tokens, 'duration-'),
  },
  {
    title: '가속 곡선',
    groups: ['timing-function'],
    render: (tokens) => renderSingleValueTable(tokens, 'ease-'),
  },
];

function code(text) {
  return `\`${text}\``;
}

function cell(text) {
  return (text ?? '').replaceAll('|', '\\|');
}

function table(header, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;

  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

/** rem 값 옆에 브라우저 기본 글자 크기(16px)에서의 px를 붙인다. */
function withPx(value) {
  const rem = /^(-?\d*\.?\d+)rem$/.exec(value);

  if (!rem) {
    return code(value);
  }

  return `${code(value)} (${Number(rem[1]) * ROOT_FONT_SIZE_PX}px)`;
}

/** 다른 토큰을 가리키는 값이면 가리키는 변수와 최종 값을 함께 보인다. */
function withResolved(value, resolved) {
  const alias = /^var\((--[a-z0-9-]+)\)$/.exec(value);

  if (!alias) {
    return code(value);
  }

  return `${code(alias[1])} → ${code(resolved)}`;
}

function describe(token) {
  if (token.description && token.darkDescription) {
    return `${token.description} 다크: ${token.darkDescription}`;
  }

  if (token.darkDescription) {
    return `다크: ${token.darkDescription}`;
  }

  return token.description ?? '';
}

function renderPaletteTable(tokens) {
  return table(
    ['이름', 'CSS 변수', '값', '설명'],
    tokens.map((token) => [
      code(token.name),
      code(token.cssVar),
      code(token.value),
      cell(describe(token)),
    ])
  );
}

function renderColorTable(tokens) {
  return table(
    ['이름', 'CSS 변수', '라이트', '다크', '설명'],
    tokens.map((token) => [
      code(token.name),
      code(token.cssVar),
      withResolved(token.value, token.resolved),
      token.darkValue === null ? SAME_AS_LIGHT : withResolved(token.darkValue, token.darkResolved),
      cell(describe(token)),
    ])
  );
}

function renderSingleValueTable(tokens, classPrefix) {
  return table(
    ['클래스', 'CSS 변수', '값', '설명'],
    tokens.map((token) => [
      code(`${classPrefix}${token.name}`),
      code(token.cssVar),
      token.value.startsWith('var(')
        ? withResolved(token.value, token.resolved)
        : withPx(token.value),
      cell(describe(token)),
    ])
  );
}

function renderScaleTable(tokens) {
  const lineHeights = new Map(
    tokens.filter((token) => token.group === 'line-height').map((token) => [token.name, token])
  );

  return table(
    ['클래스', '글자 크기', '줄 높이', '설명'],
    tokens
      .filter((token) => token.group === 'font-size')
      .map((token) => {
        const lineHeight = lineHeights.get(token.name);

        return [
          code(`text-${token.name}`),
          withPx(token.value),
          lineHeight ? withPx(lineHeight.value) : '',
          cell(describe(token)),
        ];
      })
  );
}

function renderRoleTable(tokens) {
  const roles = new Map();

  for (const token of tokens) {
    if (!roles.has(token.name)) {
      roles.set(token.name, {});
    }

    roles.get(token.name)[token.part] = token;
  }

  return table(
    ['클래스', '글자 크기', '줄 높이', '두께', '설명'],
    [...roles].map(([name, parts]) => [
      code(`text-${name}`),
      parts['font-size'] ? withPx(parts['font-size'].value) : '',
      parts['line-height'] ? withPx(parts['line-height'].value) : '',
      parts['font-weight'] ? code(parts['font-weight'].value) : '묶지 않음',
      cell(parts['font-size'] ? describe(parts['font-size']) : ''),
    ])
  );
}

function renderSection(section) {
  const tokens = TOKENS.filter((token) => section.groups.includes(token.group));
  const descriptions = TOKEN_GROUPS.filter((group) => section.groups.includes(group.id))
    .map((group) => group.description)
    .filter(Boolean);
  const sources = section.groups.map(
    (group) => `[\`${group}.tokens.json\`](../${SOURCE_DIR}/${group}.tokens.json)`
  );

  if (section.groups.includes('color')) {
    sources.push(`[\`color.dark.tokens.json\`](../${SOURCE_DIR}/color.dark.tokens.json)`);
  }

  return [
    `## ${section.title}`,
    ...descriptions,
    `원본: ${sources.join(', ')}`,
    section.render(tokens),
  ].join('\n\n');
}

function render() {
  const covered = new Set(SECTIONS.flatMap((section) => section.groups));
  const missing = TOKEN_GROUPS.map((group) => group.id).filter((id) => !covered.has(id));

  if (missing.length > 0) {
    throw new Error(
      `토큰 축 ${missing.join(', ')}을(를) 어느 절에 보일지 정해지지 않았다. scripts/generate-token-docs.js의 SECTIONS에 더한다.`
    );
  }

  return [
    '# 디자인 토큰 표',
    `> \`pnpm tokens\`가 [\`${SOURCE_DIR}/\`](../${SOURCE_DIR}/)의 원본에서 만든 파일이다. 직접 고치지 않는다.`,
    [
      `공용 UI 패키지(\`@baechan/ui\`)의 범용 토큰 ${TOKENS.length}개와 값을 정한 이유다.`,
      '앱 전용 토큰(카테고리·차트·사이드바 등)은 [`src/app/globals.css`](../src/app/globals.css)에 있고 이 표에 없다.',
      '원본과 생성물이 어떻게 이어지는지, 값을 고치는 순서는',
      '[`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) §5 "토큰 원본과 생성물"에 있다.',
      `rem 옆의 px는 브라우저 기본 글자 크기(${ROOT_FONT_SIZE_PX}px)일 때의 값이다.`,
    ].join('\n'),
    ...SECTIONS.map(renderSection),
  ].join('\n\n');
}

async function format(content) {
  const absPath = path.join(ROOT, OUTPUT);
  const options = await prettier.resolveConfig(absPath);

  return prettier.format(content, { ...options, filepath: absPath });
}

fs.writeFileSync(path.join(ROOT, OUTPUT), await format(`${render()}\n`));
console.log(`${OUTPUT}: 토큰 ${TOKENS.length}개`);
