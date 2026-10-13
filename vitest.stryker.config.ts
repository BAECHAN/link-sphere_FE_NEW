// 뮤테이션 테스트(stryker.config.json) 전용 — unit 프로젝트만 담는다. 이유는 vitest.unit.ts 참고.
import { defineConfig } from 'vitest/config';

import { sharedViteConfig, unitTestConfig } from './vitest.unit';

export default defineConfig({
  ...sharedViteConfig,
  test: unitTestConfig,
});
