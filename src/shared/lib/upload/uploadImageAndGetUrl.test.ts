import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadApi } from '@/shared/api/upload.api';
import { uploadImageAndGetUrl } from '@/shared/lib/upload/uploadImageAndGetUrl';
import { TEXTS } from '@/shared/config/texts';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import {
  ApiError,
  ImageUploadError,
  NetworkError,
  type ApiErrorResponse,
} from '@/shared/types/common.type';

vi.mock('@/shared/api/upload.api', () => ({
  uploadApi: {
    getSignedUploadUrl: vi.fn(),
    uploadFileDirectly: vi.fn(),
  },
}));

function apiError(overrides: Partial<ApiErrorResponse>, retryAfterSeconds?: number): ApiError {
  const error = new ApiError({
    status: 400,
    code: 'X',
    message: 'x',
    timestamp: '2026-10-05T00:00:00.000Z',
    ...overrides,
  });
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

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

  describe('업로드 단계 실패를 ImageUploadError로 모은다', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });

    it('서명 URL의 업로드 한도(429)는 Retry-After와 함께 rateLimited로 바꾼다', async () => {
      vi.mocked(uploadApi.getSignedUploadUrl).mockRejectedValue(apiError({ status: 429 }, 1380));

      const error = await uploadImageAndGetUrl(file).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ImageUploadError);
      expect(error).toMatchObject({ reason: 'rateLimited', retryAfterSeconds: 1380 });
    });

    it.each([
      [
        '확장자 거부',
        apiError({ code: SERVER_ERROR_CODE.UNSUPPORTED_IMAGE_TYPE }),
        'unsupportedType',
      ],
      ['서명 URL 5xx', apiError({ status: 504 }), 'failed'],
      ['연결 끊김', new NetworkError(), 'network'],
    ])('%s는 업로드 단계 실패로 바꾼다', async (_label, cause, reason) => {
      vi.mocked(uploadApi.getSignedUploadUrl).mockRejectedValue(cause);

      await expect(uploadImageAndGetUrl(file)).rejects.toMatchObject({ reason });
    });

    it('스토리지 PUT이 던진 ImageUploadError는 그대로 둔다', async () => {
      const cause = new ImageUploadError('tooLarge');
      vi.mocked(uploadApi.uploadFileDirectly).mockRejectedValue(cause);

      await expect(uploadImageAndGetUrl(file)).rejects.toBe(cause);
    });

    it('로그인 만료처럼 단계와 무관하게 뜻이 같은 ApiError는 그대로 둔다', async () => {
      const cause = apiError({ status: 401, code: SERVER_ERROR_CODE.NOT_LOGGED_IN });
      vi.mocked(uploadApi.getSignedUploadUrl).mockRejectedValue(cause);

      await expect(uploadImageAndGetUrl(file)).rejects.toBe(cause);
    });
  });
});
