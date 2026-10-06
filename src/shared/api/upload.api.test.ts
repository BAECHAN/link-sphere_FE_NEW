import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { uploadApi } from '@/shared/api/upload.api';
import { ImageUploadError, NetworkError } from '@/shared/types/common.type';

const signed = {
  uploadUrl: 'https://storage.test/object/upload/sign/comments/a.png?token=t',
  token: 't',
  publicUrl: 'https://storage.test/object/public/comments/a.png',
};
const file = new File(['x'], 'a.png', { type: 'image/png' });

async function uploadError(): Promise<unknown> {
  try {
    await uploadApi.uploadFileDirectly(signed, file);
  } catch (error) {
    return error;
  }

  throw new Error('업로드가 실패하지 않았다');
}

describe('uploadApi.uploadFileDirectly', () => {
  // Supabase는 버킷 제한 위반을 HTTP 400으로 주고 진짜 원인은 본문 statusCode에 담는다
  it.each([
    ['413', 'tooLarge'],
    ['415', 'unsupportedType'],
    ['400', 'failed'],
  ])('HTTP 400이어도 본문 statusCode "%s"로 원인(%s)을 정한다', async (statusCode, reason) => {
    server.use(
      http.put(signed.uploadUrl, () =>
        HttpResponse.json({ statusCode, error: 'x', message: 'x' }, { status: 400 })
      )
    );

    const error = await uploadError();

    expect(error).toBeInstanceOf(ImageUploadError);
    expect((error as ImageUploadError).reason).toBe(reason);
  });

  it.each([429, 500, 544])('스토리지 혼잡·장애(HTTP %s)는 잠시 불안정으로 본다', async (status) => {
    server.use(http.put(signed.uploadUrl, () => new HttpResponse('busy', { status })));

    const error = await uploadError();

    expect((error as ImageUploadError).reason).toBe('storageUnavailable');
  });

  it('응답을 못 받으면(연결 끊김) NetworkError를 던진다', async () => {
    server.use(http.put(signed.uploadUrl, () => HttpResponse.error()));

    expect(await uploadError()).toBeInstanceOf(NetworkError);
  });
});
