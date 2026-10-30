import { createOpenApiHttp } from 'openapi-msw';
import type { paths } from '@/shared/api/generated/openapi.gen';
import { API_BASE_URL } from '@/shared/config/api';

/**
 * 스펙(`openapi.gen.ts`) 경로·응답 타입에 묶인 MSW `http`.
 * 경로는 스펙 템플릿(`'/post/{id}'`) 그대로 쓰고, `API_BASE_URL`은 여기서 한 번만 붙인다.
 * 상세는 `docs/OPENAPI-CODEGEN.md` §5-5.
 */
export const http = createOpenApiHttp<paths>({ baseUrl: API_BASE_URL });
