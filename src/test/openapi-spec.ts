import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { operations } from '@/shared/api/generated/openapi.gen';

// 계약 테스트가 손으로 둔 상수와 대조할 값을 커밋된 openapi.json에서 읽는다(docs/OPENAPI-CODEGEN.md §5-6).
// operationId에서 출발한다 - 스키마 이름으로 읽으면 BE가 그 요청의 DTO를 바꿔도 옛 값을 읽어 통과한다.
// 못 찾으면 throw한다 - new RegExp(undefined)는 무엇이든 통과시키는 /(?:)/가 되어 원인을 가린다.
// 지금 스펙에 없는 모양(필드의 $ref·anyOf 등)은 풀지 않고 throw한다. 그런 스펙이 오면 그때 넓힌다.

type FieldSchema = Record<string, unknown>;

interface OpenApiSpec {
  paths: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
      }
    >
  >;
  components: { schemas: Record<string, { properties?: Record<string, FieldSchema> }> };
}

// vitest는 레포(워크트리) 루트를 process.cwd()로 실행한다(storage-keys.test.ts와 같은 방식)
const spec = JSON.parse(
  readFileSync(join(process.cwd(), 'src/shared/api/generated/openapi.json'), 'utf-8')
) as OpenApiSpec;

function findField(operationId: keyof operations, field: string): FieldSchema {
  const matches = Object.values(spec.paths)
    .flatMap((pathItem) => Object.values(pathItem))
    .filter((operation) => operation.operationId === operationId);
  const ref = matches[0]?.requestBody?.content?.['application/json']?.schema?.$ref ?? '';
  const schemaName = ref.replace('#/components/schemas/', '');
  const schema = spec.components.schemas[schemaName]?.properties?.[field];

  if (matches.length !== 1 || !schema) {
    throw new Error(`openapi.json: ${operationId} 요청 본문에서 ${field}를 찾지 못했다`);
  }

  return schema;
}

export function specNumber(
  operationId: keyof operations,
  field: string,
  keyword: 'minLength' | 'maxLength' | 'maxItems' | 'x-max-bytes'
): number {
  const value = findField(operationId, field)[keyword];

  if (typeof value !== 'number') {
    throw new Error(`openapi.json: ${operationId} > ${field}에 ${keyword} 숫자가 없다`);
  }

  return value;
}

export function specPattern(operationId: keyof operations, field: string): RegExp {
  const source = findField(operationId, field).pattern;

  if (typeof source !== 'string' || source === '') {
    throw new Error(`openapi.json: ${operationId} > ${field}에 pattern이 없다`);
  }

  return new RegExp(source);
}
