import { describe, expect, it } from 'vitest';
import { NumberUtil } from '@/shared/utils/number.util';

describe('NumberUtil', () => {
  describe('formatCompact', () => {
    it('1000 미만은 그대로 쓴다', () => {
      expect(NumberUtil.formatCompact(0)).toBe('0');
      expect(NumberUtil.formatCompact(999)).toBe('999');
    });

    it('천 단위는 소수 첫째 자리까지 줄인다', () => {
      expect(NumberUtil.formatCompact(1000)).toBe('1천');
      expect(NumberUtil.formatCompact(1234)).toBe('1.2천');
    });

    it('만 단위부터는 만으로 줄인다', () => {
      expect(NumberUtil.formatCompact(56789)).toBe('5.7만');
      // 카드 최소 폭(292px)을 잰 최악값
      expect(NumberUtil.formatCompact(9_990_000)).toBe('999만');
    });
  });
});
