import type { components } from '@/shared/api/generated/openapi.gen';

type Schemas = components['schemas'];

/**
 * springdoc이 ApiResponse<T>를 평탄화한 래퍼 스키마(ApiResponsePostResponse 등)에서
 * data 부분만 뽑는다. apiClient(client.ts:239)가 이미 런타임에서 data를 언랩하므로
 * 타입도 맞춰야 한다.
 *
 * 대부분의 응답은 안쪽 DTO가 PostResponse처럼 독립된 named schema로도 나오므로 그걸
 * 바로 쓰면 되고, 이 헬퍼는 안쪽이 익명 타입(Map/Unit/List)이라 이름이 없는 경우에만 쓴다.
 */
export type Unwrap<K extends keyof Schemas> = Schemas[K] extends { data: infer D } ? D : never;
