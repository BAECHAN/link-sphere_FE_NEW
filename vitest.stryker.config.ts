// 뮤테이션 테스트(stryker.config.json) 전용 — unit 프로젝트와 공용 UI 패키지(packages/ui) 프로젝트를 담는다. 이유는 vitest.unit.ts 참고.
import path from 'path';

import { defineConfig } from 'vitest/config';

import { sharedViteConfig, unitTestConfig } from './vitest.unit';

export default defineConfig({
  ...sharedViteConfig,
  resolve: {
    alias: {
      ...sharedViteConfig.resolve.alias,
      // Stryker는 저장소를 sandbox 폴더에 복사해 돌린다. 앱의 `@baechan/ui` import는 node_modules 링크를 따라
      // sandbox 밖 원본으로 가고, 패키지 안 파일의 자기 참조는 Vite가 가장 가까운 package.json으로 풀어 sandbox 사본으로
      // 간다. 같은 모듈이 두 벌이 돼 문구 Provider Context가 갈리고(계약 테스트 실패), 앱 테스트가 패키지 변이를 보지 못한다.
      // sandbox 안의 패키지 소스로 맞춘다(2026-11-20 재현, docs/DESIGN-SYSTEM-PRINCIPLES.md §1.5)
      // 공개 경로가 src 폴더 구조와 다른 것은 아래 일괄 별칭보다 먼저 적는다. Vite는 처음 맞는 별칭을 쓴다
      // (빠뜨리면 그 경로를 import하는 테스트가 "Failed to resolve import"로 실패한다, 2026-11-25 재현)
      '@baechan/ui/tokens': path.resolve(__dirname, './packages/ui/src/generated/tokens.gen.ts'),
      '@baechan/ui': path.resolve(__dirname, './packages/ui/src'),
    },
  },
  test: { projects: [{ extends: true, test: unitTestConfig }, 'packages/ui'] },
});
