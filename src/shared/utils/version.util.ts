/** Vite가 index.html에 심는 진입 스크립트 - dev는 /src/main.tsx, prod는 /assets/js/index-<hash>.js */
const ENTRY_SCRIPT_SELECTOR = 'script[type="module"][src]';

/**
 * 배포된 index.html의 진입 청크 파일명(해시 포함)으로 "지금 돌고 있는 빌드가 최신인가"를 판단한다.
 *
 * 현재 문서와 서버 응답을 같은 셀렉터로 읽는다 - 한쪽만 정규식이나 빌드타임 상수로 뽑으면
 * Vite 출력 형태가 바뀔 때 두 추출 경로가 갈라져 비교가 조용히 어긋난다.
 * 진입 청크 해시를 빌드타임 상수(define)로 주입할 수는 없다: 해시는 최종 청크 내용으로
 * 계산되는데 값을 주입하면 그 내용이 다시 바뀐다(순환).
 */
export class VersionUtil {
  /** 문서에서 진입 스크립트 src를 읽는다. 못 찾으면 null(판단 보류). */
  static readEntryScriptSrc(doc: Document): string | null {
    return doc.querySelector(ENTRY_SCRIPT_SELECTOR)?.getAttribute('src') ?? null;
  }

  /**
   * 서버의 최신 index.html을 받아 진입 스크립트 src를 읽는다.
   * 네트워크 실패·비정상 응답·파싱 실패는 전부 null - 조용히 넘어간다.
   *
   * DOMParser로 만든 문서는 browsing context가 없어 스크립트 실행·하위 리소스 로드가 없다
   * (index.html의 Google Fonts stylesheet·폰트 preload가 다시 받아지지 않는다).
   */
  static async fetchDeployedEntryScriptSrc(): Promise<string | null> {
    try {
      const response = await fetch('/index.html', { cache: 'no-store' });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      const deployedDocument = new DOMParser().parseFromString(html, 'text/html');

      return this.readEntryScriptSrc(deployedDocument);
    } catch {
      return null;
    }
  }
}
