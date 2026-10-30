import { HttpResponse } from 'msw';

/**
 * BE 응답 봉투(`ApiResponse<T>` — `{ status, message, data, timestamp }`)를 만드는 MSW 응답 헬퍼.
 * 기본 핸들러(`src/mocks/handlers/**`)는 `HttpResponse`를 직접 쓰지 않고 이 헬퍼로만 응답한다
 * — `new HttpResponse(null)`·`HttpResponse.json(null)`은 스펙 타입 검사를 빠져나가기 때문이다
 * (`docs/OPENAPI-CODEGEN.md` §5-5).
 */
export class MockEnvelopeUtil {
  /** `data`가 있는 봉투. HTTP 상태와 봉투의 `status`를 같은 값으로 맞춘다. */
  static json<T>(data: T, status = 200) {
    // HttpResponse.json은 본문 인자가 NoInfer라 인자로 타입을 추론하지 않는다 — 명시하지 않으면
    // JsonBodyType으로 넓어져 핸들러의 스펙 타입 검사가 무의미해진다
    return HttpResponse.json<{ status: number; message: string; data: T; timestamp: string }>(
      { status, message: 'ok', data, timestamp: new Date().toISOString() },
      { status }
    );
  }

  /**
   * `ApiResponse<Unit>` 봉투. 스펙(`ApiResponseUnit`)에는 `data`가 없지만 운영은 `"data":{}`를
   * 보낸다(2026-10-30 `POST /auth/logout` 익명 호출로 실측) — 운영과 같게 빈 객체를 넣는다.
   */
  static unit(status = 200) {
    return MockEnvelopeUtil.json<Record<string, never>>({}, status);
  }
}
