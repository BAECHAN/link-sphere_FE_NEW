import { defineConfig } from 'orval';

// BE 요청 본문의 입력 제약(길이·패턴·개수)을 zod 상수로 생성한다(docs/OPENAPI-CODEGEN.md §5-2 "orval zod로 제약 상수").
// 생성 파일은 계약 테스트(entities/*/config/*.contract.test.ts)만 import해 손으로 둔 상수와 대조한다 - 상수와
// zod.object(...)가 한 파일에 있어 런타임 코드가 import하면 그 청크가 zod-vendor를 끌어온다(eslint.config.js
// no-generated-zod-import).
export default defineConfig({
  api: {
    input: { target: './src/shared/api/generated/openapi.json' },
    output: {
      client: 'zod',
      mode: 'single',
      target: './src/shared/api/generated/openapi.zod.ts',
      override: {
        zod: {
          version: 3,
          generate: { param: false, query: false, header: false, body: true, response: false },
        },
      },
    },
  },
});
