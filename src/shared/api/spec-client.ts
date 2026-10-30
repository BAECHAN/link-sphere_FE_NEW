import type { paths } from '@/shared/api/generated/openapi.gen';
import { apiClient } from '@/shared/api/client';
import type { PathsWithMethod, SpecData, SpecInit, SpecMethod } from '@/shared/api/spec-types';

// apiClient(토큰 갱신·NFC 정규화·OAC 서명·WAF 판별)를 그대로 쓰고, 그 위에 스펙 경로 타입만 얹은 얇은 래퍼다.
// 경로 문자열('/post/{id}')이 스펙의 경로 변수·쿼리·본문·응답 타입을 정한다 — 없는 경로·메서드,
// 빠뜨린 경로 변수, 스펙과 다른 본문은 컴파일 단계에서 막힌다. 설계 배경: docs/OPENAPI-CODEGEN.md §5-2
//
// 두 번째 제네릭 R은 스펙 응답보다 좁힌 도메인 타입(예: Account의 role)을 쓸 때만 명시한다.
// 스펙 응답의 하위 타입만 받고, 반환 위치는 NoInfer라 `const a: Account = await specClient.get(...)`처럼
// 대입할 변수 타입에서 R이 조용히 추론되지 않는다 — 좁히려면 호출부에 R을 적어야 한다.

type ApiRequestOptions = NonNullable<Parameters<typeof apiClient.get>[1]>;

/** keepalive 같은 fetch 옵션. 쿼리는 init.query, 본문은 init.body로만 받는다 */
export type SpecRequestOptions = Omit<
  ApiRequestOptions,
  'searchParams' | 'body' | 'method' | 'responseType'
>;

type SpecRest<P extends keyof paths, M extends SpecMethod> =
  Record<never, never> extends SpecInit<P, M>
    ? [init?: SpecInit<P, M>, options?: SpecRequestOptions]
    : [init: SpecInit<P, M>, options?: SpecRequestOptions];

type RuntimeRest = [
  init?: { path?: Record<string, string>; query?: Record<string, unknown>; body?: unknown },
  options?: SpecRequestOptions,
];

function resolveRequest(template: string, rest: readonly unknown[]) {
  // 호출 시점의 타입 검사는 SpecRest가 이미 끝냈다. 여기서는 런타임 모양으로만 읽는다.
  const [init, options] = rest as RuntimeRest;
  const params = init?.path;
  const endpoint = params
    ? template.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(String(params[key])))
    : template;

  return {
    endpoint,
    body: init?.body,
    options: { ...options, searchParams: init?.query },
  };
}

export const specClient = {
  get<P extends PathsWithMethod<'get'>, R extends SpecData<P, 'get'> = SpecData<P, 'get'>>(
    path: P,
    ...rest: SpecRest<P, 'get'>
  ): Promise<NoInfer<R>> {
    const { endpoint, options } = resolveRequest(path, rest);

    return apiClient.get<R>(endpoint, options);
  },

  post<P extends PathsWithMethod<'post'>, R extends SpecData<P, 'post'> = SpecData<P, 'post'>>(
    path: P,
    ...rest: SpecRest<P, 'post'>
  ): Promise<NoInfer<R>> {
    const { endpoint, body, options } = resolveRequest(path, rest);

    return apiClient.post<R>(endpoint, body, options);
  },

  put<P extends PathsWithMethod<'put'>, R extends SpecData<P, 'put'> = SpecData<P, 'put'>>(
    path: P,
    ...rest: SpecRest<P, 'put'>
  ): Promise<NoInfer<R>> {
    const { endpoint, body, options } = resolveRequest(path, rest);

    return apiClient.put<R>(endpoint, body, options);
  },

  patch<P extends PathsWithMethod<'patch'>, R extends SpecData<P, 'patch'> = SpecData<P, 'patch'>>(
    path: P,
    ...rest: SpecRest<P, 'patch'>
  ): Promise<NoInfer<R>> {
    const { endpoint, body, options } = resolveRequest(path, rest);

    return apiClient.patch<R>(endpoint, body, options);
  },

  delete<
    P extends PathsWithMethod<'delete'>,
    R extends SpecData<P, 'delete'> = SpecData<P, 'delete'>,
  >(path: P, ...rest: SpecRest<P, 'delete'>): Promise<NoInfer<R>> {
    const { endpoint, body, options } = resolveRequest(path, rest);

    // 본문이 없으면 undefined가 넘어가 apiClient.delete가 body를 아예 싣지 않는다
    return apiClient.delete<R>(endpoint, body, options);
  },
};
