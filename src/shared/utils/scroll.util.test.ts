import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollUtil } from '@/shared/utils/scroll.util';

function stubReducedMotion(reduce: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === '(prefers-reduced-motion: reduce)' && reduce,
        media: query,
      }) as MediaQueryList
  );
}

describe('ScrollUtil', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBehavior', () => {
    it('동작 줄이기를 켜지 않았으면 부드럽게 스크롤한다', () => {
      stubReducedMotion(false);

      expect(ScrollUtil.getBehavior()).toBe('smooth');
    });

    it('동작 줄이기를 켰으면 바로 이동한다', () => {
      stubReducedMotion(true);

      expect(ScrollUtil.getBehavior()).toBe('auto');
    });
  });
});
