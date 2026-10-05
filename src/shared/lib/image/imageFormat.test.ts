import { describe, it, expect } from 'vitest';
import { getUploadExtension, isAllowedImageType } from '@/shared/lib/image/imageFormat';

describe('imageFormat', () => {
  it('허용 목록의 MIME은 통과시키고 업로드 확장자를 MIME에서 정한다', () => {
    expect(isAllowedImageType('image/jpeg')).toBe(true);
    expect(getUploadExtension('image/jpeg')).toBe('jpg');
    expect(getUploadExtension('image/svg+xml')).toBe('svg');
    expect(getUploadExtension('image/webp')).toBe('webp');
  });

  it('브라우저가 이미지로 보더라도 허용 목록 밖 형식(bmp·tiff·ico·heic·heif)은 거부한다', () => {
    ['image/bmp', 'image/tiff', 'image/x-icon', 'image/heic', 'image/heif'].forEach((type) => {
      expect(isAllowedImageType(type)).toBe(false);
      expect(getUploadExtension(type)).toBeUndefined();
    });
  });

  it('MIME이 비었거나 이미지가 아니면 거부한다', () => {
    expect(isAllowedImageType('')).toBe(false);
    expect(isAllowedImageType('application/pdf')).toBe(false);
  });

  it('Object 기본 프로퍼티 이름은 허용 형식으로 오인하지 않는다', () => {
    expect(isAllowedImageType('toString')).toBe(false);
    expect(getUploadExtension('toString')).toBeUndefined();
  });
});
