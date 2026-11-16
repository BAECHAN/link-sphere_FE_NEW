// 배포 때 미리 brotli로 눌러 둘 자산을 고르고 짝(.br)이 다 있는지 본다(scripts/precompress-assets.js가 쓴다).
// 파일 읽기·압축과 분리해 두어 선별 규칙만 단위 테스트로 고정한다(src/test/scripts/precompress-assets.test.ts).

/** 사전 압축 사본의 접미사. CloudFront Function(spa-fallback.js)이 br을 받는 요청의 주소 끝에 붙인다 */
export const BROTLI_SUFFIX = '.br';

/**
 * 사전 압축 대상인가: assets/ 아래의 .js·.css. spa-fallback.js의 PRECOMPRESSED_ASSET과 같은 범위여야 한다 -
 * Function은 파일이 있는지 모르고 주소만 바꾸므로, 여기서 빠진 파일은 br을 받는 브라우저에서 403이 된다.
 *
 * @param {string} key dist/ 상대 경로(예: assets/js/index-abc.js)
 */
export function isPrecompressTarget(key) {
  return /^assets\/.+\.(js|css)$/.test(key);
}

/**
 * 대상인데 짝(.br)이 없는 키를 돌려준다. 하나라도 있으면 배포를 멈춘다.
 *
 * @param {Iterable<string>} keys dist/ 상대 경로 전체
 * @returns {string[]}
 */
export function findMissingPairs(keys) {
  const all = new Set(keys);

  return [...all].filter((key) => isPrecompressTarget(key) && !all.has(key + BROTLI_SUFFIX));
}
