import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformUtil } from '@/shared/utils/platform.util';

const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('PlatformUtil', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isMac', () => {
    it('macOS UA면 true다', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(MAC_UA);

      expect(PlatformUtil.isMac()).toBe(true);
    });

    it('Windows UA면 false다', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(WINDOWS_UA);

      expect(PlatformUtil.isMac()).toBe(false);
    });
  });
});
