/**
 * BE 응답 래핑 형태(ApiResponse<T>)를 그대로 흉내낸다 — client.ts:241의 언래핑 조건
 * ('data'·'status' 키 존재)을 통과시켜야 하므로, src/mocks/handlers/*.handlers.ts가 쓰는
 * 것과 같은 shape를 재사용한다.
 */
export function wrapResponse<T>(data: T, status = 200) {
  return {
    status,
    message: 'ok',
    data,
    timestamp: new Date().toISOString(),
  };
}
