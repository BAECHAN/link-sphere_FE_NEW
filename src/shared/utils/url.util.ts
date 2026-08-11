export class UrlUtil {
  /**
   * 사용자가 붙여넣은 URL의 공백을 서버가 받을 수 있는 형태로 정리한다.
   * BE SafeUrlValidator의 java.net.URI는 RFC 2396 엄격 파서라 생 공백을 거부하는 반면
   * FE zod .url() (WHATWG)은 통과시켜, 검증을 통과한 URL이 400으로 떨어지는 불일치가 있었다.
   * 공백 외의 문자(한글 등)는 java.net.URI가 그대로 받으므로 건드리지 않는다.
   */
  static normalizeUrl(input: string): string {
    return input
      .trim()
      .replace(/[\t\n\r]/g, '')
      .replace(/ /g, '%20');
  }
}
