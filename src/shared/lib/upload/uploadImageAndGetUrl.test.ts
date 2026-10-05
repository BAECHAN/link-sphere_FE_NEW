import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadApi } from '@/shared/api/upload.api';
import { uploadImageAndGetUrl } from '@/shared/lib/upload/uploadImageAndGetUrl';
import { TEXTS } from '@/shared/config/texts';

vi.mock('@/shared/api/upload.api', () => ({
  uploadApi: {
    getSignedUploadUrl: vi.fn(),
    uploadFileDirectly: vi.fn(),
  },
}));

const signed = {
  uploadUrl: 'https://storage/upload',
  token: 't',
  publicUrl: 'https://storage/public/x',
};

describe('uploadImageAndGetUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadApi.getSignedUploadUrl).mockResolvedValue(signed);
    vi.mocked(uploadApi.uploadFileDirectly).mockResolvedValue(undefined);
  });

  // jsdom에는 createImageBitmap이 없어 resizeImageFile이 원본을 그대로 돌려준다 - 확장자 결정만 본다.
  it('확장자를 파일명이 아니라 MIME에서 정한다 - .jfif(JPEG)도 jpg로 요청한다', async () => {
    const file = new File(['x'], 'photo.jfif', { type: 'image/jpeg' });

    await uploadImageAndGetUrl(file);

    expect(uploadApi.getSignedUploadUrl).toHaveBeenCalledWith('jpg');
  });

  it('확장자 없는 파일도 MIME으로 확장자를 정한다', async () => {
    const file = new File(['x'], 'screenshot', { type: 'image/png' });

    await uploadImageAndGetUrl(file);

    expect(uploadApi.getSignedUploadUrl).toHaveBeenCalledWith('png');
  });

  it('허용 목록 밖 형식이면 서명 URL을 요청하지 않고 형식 안내 에러를 던진다', async () => {
    const file = new File(['x'], 'scan.bmp', { type: 'image/bmp' });

    await expect(uploadImageAndGetUrl(file)).rejects.toThrow(TEXTS.validation.imageFileOnly);
    expect(uploadApi.getSignedUploadUrl).not.toHaveBeenCalled();
  });
});
