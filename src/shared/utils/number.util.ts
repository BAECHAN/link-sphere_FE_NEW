// 카드 푸터가 한 줄을 유지하는 최소 폭(post-card-grid.const.ts의 minColumnWidth)이 숫자 자릿수에 따라
// 늘어나지 않도록 큰 수를 줄여 쓴다(docs/plans/2026-10-28-tablet-width-rail.md)
const compactFormatter = new Intl.NumberFormat('ko-KR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export class NumberUtil {
  /**
   * 큰 수를 한국어 단위로 줄여 쓴다(1234 → 1.2천, 56789 → 5.7만). 1000 미만은 그대로다.
   * @param value 숫자
   * @returns 축약한 문자열
   */
  static formatCompact(value: number): string {
    return compactFormatter.format(value);
  }
}
