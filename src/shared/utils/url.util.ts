// 글 상세 라우트 `/post/:id`만이다. `/post/submit`·`/post/edit/<id>`는 글 상세가 아니다. BE PostLinkParser와 같은 규칙이다
const POST_DETAIL_PATH = /^\/post\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/?$/i;

// 호스트는 대소문자를 가리지 않고 `www.`가 붙어도 같은 사이트다(BE PostLinkParser와 같다)
function siteHostOf(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

export class UrlUtil {
  /**
   * 지금 사이트의 글 상세 주소면 앱 안에서 이동할 경로(쿼리·`#comment-…` 포함)를, 아니면 null을 준다. 댓글의 우리 글
   * 링크를 새 탭 대신 앱 안에서 열 때 쓴다(docs/plans/2026-11-19-post-link-in-app-and-og.md). 사이트 주소 상수가 없어
   * 지금 페이지의 호스트와 비교한다 - dev(localhost)에서는 운영 주소가 다른 사이트로 보인다.
   */
  static toInAppPostPath(url: string): string | null {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    if (siteHostOf(parsed.host) !== siteHostOf(window.location.host)) {
      return null;
    }

    if (!POST_DETAIL_PATH.test(parsed.pathname)) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  /**
   * 앱의 "링크 복사"가 URL 앞에 글자를 붙여 준 공유 문구(예: 네이버 지도 `알배기 독막로3길 35 2층 https://naver.me/…`)에서
   * 첫 http(s) URL과 나머지 글자를 나눈다. 나머지 글자는 공백을 한 칸으로 줄인다.
   * http(s)://로 시작하는 값은 나누지 않고 null을 준다 - 공백 낀 URL은 지금처럼 normalizeUrl이 `%20`으로 바꾼다.
   * 대소문자는 post.schema.ts의 URL 검증(`/^https?:\/\//`)과 같게 소문자만 본다.
   */
  static splitSharedText(input: string): { url: string; text: string } | null {
    if (/^https?:\/\//.test(input.trim())) {
      return null;
    }

    const match = /https?:\/\/\S+/.exec(input);

    if (!match) {
      return null;
    }

    const rest = input.slice(0, match.index) + ' ' + input.slice(match.index + match[0].length);

    return { url: match[0], text: rest.replace(/\s+/g, ' ').trim() };
  }

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
