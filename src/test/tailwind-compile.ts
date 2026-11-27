import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';

// 생성된 토큰 CSS를 설치된 Tailwind로 실제로 컴파일한다. 토큰의 테마 키가 클래스로 이어지는지 보는 테스트가 쓴다
// (tailwind-motion-theme.test.ts, tailwind-shadow-theme.test.ts, tailwind-spacing-theme.test.ts)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const stylesDir = join(repoRoot, 'packages/ui/src/styles');
const require = createRequire(import.meta.url);

/** Tailwind 기본 테마·유틸리티 뒤에 생성된 토큰 CSS를 두고, 주어진 클래스만 CSS로 만든다 */
export async function buildTokenCss(candidates: string[]) {
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
export function ruleBody(css: string, className: string) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp(`\\.${escaped} \\{([^}]*)\\}`).exec(css)?.[1] ?? null;
}
