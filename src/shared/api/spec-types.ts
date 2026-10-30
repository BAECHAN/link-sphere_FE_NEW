import type { paths } from '@/shared/api/generated/openapi.gen';

// 생성된 스펙 타입(openapi.gen.ts의 paths)에서 경로·메서드별 요청·응답 타입을 꺼내는 타입 헬퍼다.
// spec-client.ts가 쓴다. 런타임 코드는 없다. header·cookie 파라미터는 다루지 않는다 — 인증은
// apiClient가 헤더·쿠키로 직접 붙이고, 스펙에도 header·cookie 파라미터를 받는 엔드포인트가 없다.

export type SpecMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** 그 메서드가 스펙에 정의된 경로만. 없는 메서드는 생성 파일에 `put?: never`처럼 optional로 실려 걸러진다 */
export type PathsWithMethod<M extends SpecMethod> = {
  [P in keyof paths]: paths[P] extends Record<M, unknown> ? P : never;
}[keyof paths];

type OperationOf<P extends keyof paths, M extends SpecMethod> = paths[P][M];

type ParametersOf<Op> = Op extends { parameters: infer X } ? X : never;

/** `{id}` 같은 경로 변수. 경로 변수가 없으면 never */
export type PathParamsOf<Op> = ParametersOf<Op> extends { path: infer X } ? X : never;

/** 쿼리 파라미터. 없으면 never */
export type QueryOf<Op> = ParametersOf<Op> extends { query?: infer X } ? NonNullable<X> : never;

/** 요청 본문. 미디어 타입(application/json 등)과 무관하게 꺼낸다. 없으면 never */
export type RequestBodyOf<Op> = Op extends { requestBody?: infer B }
  ? B extends { content: infer C }
    ? C[keyof C]
    : never
  : never;

type ContentOf<R> = R extends { content: infer C } ? C[keyof C] : never;

/** 200·201 응답 본문(봉투째). BE 응답 미디어 타입이 전부 `*\/*`라 미디어 타입과 무관하게 꺼낸다 */
export type SuccessBodyOf<Op> = Op extends { responses: infer R }
  ? ContentOf<R[keyof R & (200 | 201)]>
  : never;

/** 봉투(`{ data, message, status, timestamp }`)를 벗긴 data. 스펙의 ApiResponseUnit에는 data가 없어 void */
export type UnwrapEnvelope<T> = T extends { data: infer D } ? D : void;

/** apiClient가 봉투를 벗겨 돌려주는 값의 스펙 타입 */
export type SpecData<P extends keyof paths, M extends SpecMethod> = UnwrapEnvelope<
  SuccessBodyOf<OperationOf<P, M>>
>;

type PathPart<Op> = [PathParamsOf<Op>] extends [never]
  ? { path?: never }
  : { path: PathParamsOf<Op> };

type QueryPart<Op> = [QueryOf<Op>] extends [never]
  ? { query?: never }
  : ParametersOf<Op> extends { query: unknown }
    ? { query: QueryOf<Op> }
    : { query?: QueryOf<Op> };

type BodyPart<Op> = [RequestBodyOf<Op>] extends [never]
  ? { body?: never }
  : Op extends { requestBody: unknown }
    ? { body: RequestBodyOf<Op> }
    : { body?: RequestBodyOf<Op> };

/** 경로 변수·쿼리·본문. 스펙에 없는 것은 넘기면 타입 오류, 스펙이 필수로 둔 것은 빠뜨리면 타입 오류 */
export type SpecInit<P extends keyof paths, M extends SpecMethod> = PathPart<OperationOf<P, M>> &
  QueryPart<OperationOf<P, M>> &
  BodyPart<OperationOf<P, M>>;
