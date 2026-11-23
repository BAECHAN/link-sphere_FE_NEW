import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 이 앱(루트 package.json)과 공용 UI 패키지(packages/ui/package.json)가 같은 패키지를 서로 다른 버전으로 선언하면
// pnpm이 두 벌을 깐다. 모듈이 두 벌이면 React context가 갈린다 - 앱의 테마 Provider(next-themes)와 패키지 Toaster의
// useTheme이 서로 다른 모듈을 보면 토스트 테마가 앱 테마를 따라가지 않는다(2026-11-20 예제 앱에서 측정,
// docs/DESIGN-SYSTEM-PRINCIPLES.md §1.5). 한쪽만 올리는 변경이 여기서 실패하게 한다.
// 이 파일 기준 경로로 읽는다(선례: packages/ui/src/lib/tailwind/utils.test.ts)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readManifest(relativePath: string): Manifest {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf-8')) as Manifest;
}

const app = readManifest('package.json');
const ui = readManifest('packages/ui/package.json');
const appDeclared: Record<string, string> = { ...app.devDependencies, ...app.dependencies };
const shared = Object.entries(ui.dependencies ?? {}).filter(([name]) => name in appDeclared);

describe('앱과 공용 UI 패키지가 함께 선언한 의존성', () => {
  // 목록이 비면 아래 it.each가 아무것도 검사하지 않고 통과한다. next-themes를 패키지가 직접 깔지 않게 바꾸면
  // (받는 쪽 것을 쓰는 peer로) 이 단언도 그 결정에 맞춰 고친다
  it('앱과 패키지가 한 벌로 써야 하는 next-themes가 대조 목록에 든다', () => {
    expect(shared.map(([name]) => name)).toContain('next-themes');
  });

  it.each(shared)('%s의 버전 선언이 두 package.json에서 같다', (name, uiSpec) => {
    expect(
      appDeclared[name],
      `${name}: 루트 package.json은 "${appDeclared[name]}", packages/ui/package.json은 "${uiSpec}"다. 두 곳을 같은 버전으로 맞춘다`
    ).toBe(uiSpec);
  });
});
