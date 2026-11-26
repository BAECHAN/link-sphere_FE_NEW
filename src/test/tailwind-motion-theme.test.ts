import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import { TOKENS } from '@baechan/ui/tokens';

// 시간·곡선 토큰은 Tailwind 테마 키(--transition-duration-*, --ease-*)로 내보내 duration-<이름>, ease-<이름> 클래스가 되게 한다.
// duration이 --transition-duration을 읽는 것은 Tailwind 공식 문서의 테마 이름 표에 없고 설치본 코드(4.3.5 dist/lib.js)에만 있는
// 동작이라, Tailwind를 올렸을 때 조용히 바뀌면 여기서 실패하게 한다(docs/plans/2026-11-24-design-tokens-stage2.md 결과 블록의
// PR 1 약속). 생성된 토큰 CSS를 설치된 Tailwind로 실제로 컴파일해 본다
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const stylesDir = join(repoRoot, 'packages/ui/src/styles');
const require = createRequire(import.meta.url);

async function buildCss(candidates: string[]) {
  const input = [
    "@import 'tailwindcss/theme.css' layer(theme);",
    "@import 'tailwindcss/utilities.css' layer(utilities);",
    "@import './tokens.gen.css';",
  ].join('\n');
  const compiler = await compile(input, {
    base: stylesDir,
    loadStylesheet: async (id, base) => {
      const path = id.startsWith('.') ? join(base, id) : require.resolve(id);

      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });

  return compiler.build(candidates);
}

/** `.<클래스> { ... }` 규칙의 선언 본문. 규칙이 만들어지지 않았으면 null */
function ruleBody(css: string, className: string) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp(`\\.${escaped} \\{([^}]*)\\}`).exec(css)?.[1] ?? null;
}

const durationTokens = TOKENS.filter((token) => token.group === 'duration').map(
  ({ name, cssVar }) => [name, cssVar]
);
const easeTokens = TOKENS.filter((token) => token.group === 'timing-function').map(
  ({ name, cssVar }) => [name, cssVar]
);

describe('Tailwind가 시간·곡선 토큰을 클래스로 만든다', () => {
  it('토큰 목록에 시간·곡선 토큰이 있다', () => {
    expect(durationTokens.map(([name]) => name)).toContain('d4');
    expect(easeTokens.map(([name]) => name)).toContain('easing');
  });

  it.each(durationTokens)('duration-%s이 %s를 읽는다', async (name, cssVar) => {
    const body = ruleBody(await buildCss([`duration-${name}`]), `duration-${name}`);

    expect(body).toContain(`transition-duration: var(${cssVar});`);
    expect(body).toContain(`--tw-duration: var(${cssVar});`);
  });

  it.each(easeTokens)('ease-%s이 %s를 읽는다', async (name, cssVar) => {
    const body = ruleBody(await buildCss([`ease-${name}`]), `ease-${name}`);

    expect(body).toContain(`transition-timing-function: var(${cssVar});`);
    expect(body).toContain(`--tw-ease: var(${cssVar});`);
  });

  it('시간·곡선 클래스 없이 transition만 쓴 곳은 기본값을 거쳐 토큰을 읽는다', async () => {
    const css = await buildCss(['transition']);

    expect(ruleBody(css, 'transition')).toContain(
      'transition-duration: var(--tw-duration, var(--default-transition-duration));'
    );
    // Tailwind 자신의 기본값(theme.css의 150ms 등)보다 토큰 CSS의 값이 뒤에 와서 이긴다
    expect(css).toContain(
      '--default-transition-duration: var(--transition-duration-color-transition);'
    );
    expect(css).toContain('--default-transition-timing-function: var(--ease-easing);');
    expect(css).not.toContain('--default-transition-duration: 150ms;');
  });
});
