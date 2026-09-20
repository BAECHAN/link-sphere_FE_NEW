import { describe, expect, it } from 'vitest';
import {
  hasImageFailed,
  recordImageFailure,
  resetFailedImages,
} from '@/shared/lib/image/failedImageCache';

describe('hasImageFailed / recordImageFailure', () => {
  it('1회 실패한 URL은 아직 차단 대상이 아니다', () => {
    resetFailedImages();
    recordImageFailure('https://example.com/once.png');

    expect(hasImageFailed('https://example.com/once.png')).toBe(false);
  });

  it('2회 실패한 URL은 차단 대상이다', () => {
    resetFailedImages();
    recordImageFailure('https://example.com/twice.png');
    recordImageFailure('https://example.com/twice.png');

    expect(hasImageFailed('https://example.com/twice.png')).toBe(true);
  });

  it('reset 후에는 모든 기록이 사라진다', () => {
    recordImageFailure('https://example.com/twice.png');
    recordImageFailure('https://example.com/twice.png');

    resetFailedImages();

    expect(hasImageFailed('https://example.com/twice.png')).toBe(false);
  });

  it('상한 500개를 넘으면 가장 먼저 기록된 URL부터 지워진다', () => {
    resetFailedImages();

    for (let i = 0; i < 501; i++) {
      recordImageFailure(`https://example.com/${i}.png`);
      recordImageFailure(`https://example.com/${i}.png`);
    }

    // 가장 먼저 기록된 0번은 지워지고, 이후 기록된 500번은 남아있다
    expect(hasImageFailed('https://example.com/0.png')).toBe(false);
    expect(hasImageFailed('https://example.com/500.png')).toBe(true);
  });
});
