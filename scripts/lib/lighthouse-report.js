// Lighthouse CI가 .lighthouseci/에 남긴 파일 가운데 실행 결과(LHR) JSON을 고른다(scripts/lighthouse-report.js가 쓴다).
// 파일 읽기·표 만들기와 분리해 두어 고르는 규칙만 단위 테스트로 고정한다(src/test/scripts/lighthouse-report.test.ts).

/**
 * 실행 결과 JSON인가. LHCI가 결과를 다시 읽을 때 쓰는 패턴과 같다(@lhci/utils src/saved-reports.js의 LHR_REGEX).
 * @lhci/cli 0.16.0(#618)부터 이름 뒤에 `-<숫자>`가 붙는다. 0.15.1까지의 `lhr-<시각>.json`만 받던 동안 PR 댓글의
 * 점수 표가 "측정 결과가 없다"로 비었다.
 *
 * @param {string} fileName .lighthouseci/ 안의 파일 이름
 */
export function isLhrFile(fileName) {
  return /^lhr-\d+(-\d+)?\.json$/.test(fileName);
}
