import { describe, expect, it } from 'vitest';
import { ErrorUtil } from '@/shared/utils/error.util';
import { ApiError, UserFacingError } from '@/shared/types/common.type';
import { TEXTS } from '@/shared/config/texts';

function makeApiError(status: number): ApiError {
  return new ApiError({ status, code: 'ERR', message: '서버 상세 메시지', timestamp: '' });
}

describe('ErrorUtil.isServerError', () => {
  it('500대 ApiError는 true다', () => {
    expect(ErrorUtil.isServerError(makeApiError(500))).toBe(true);
  });

  it('4xx ApiError는 false다', () => {
    expect(ErrorUtil.isServerError(makeApiError(404))).toBe(false);
  });

  it('네트워크 단절(TypeError: Failed to fetch)은 true다', () => {
    expect(ErrorUtil.isServerError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('그 외 일반 Error는 false다', () => {
    expect(ErrorUtil.isServerError(new Error('무언가 실패'))).toBe(false);
  });
});

describe('ErrorUtil.isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://example.com/chunk.js',
    'Importing a module script failed',
    'error loading dynamically imported module',
  ])('"%s" 메시지는 true다', (message) => {
    expect(ErrorUtil.isChunkLoadError(new Error(message))).toBe(true);
  });

  it('관련 없는 Error 메시지는 false다', () => {
    expect(ErrorUtil.isChunkLoadError(new Error('네트워크 오류'))).toBe(false);
  });

  it('Error가 아닌 값은 false다', () => {
    expect(ErrorUtil.isChunkLoadError('문자열 에러')).toBe(false);
  });
});

describe('ErrorUtil.resolveMessage', () => {
  it('ApiError는 서버 상세 메시지를 노출하지 않고 일반 메시지로 감싼다', () => {
    expect(ErrorUtil.resolveMessage(makeApiError(500))).toBe(TEXTS.messages.error.serverError);
  });

  it('UserFacingError는 원문 메시지를 그대로 노출한다', () => {
    const error = new UserFacingError('이미지 용량이 너무 커요.');
    expect(ErrorUtil.resolveMessage(error)).toBe('이미지 용량이 너무 커요.');
  });

  it('그 외 예상치 못한 에러는 일반 안내 문구로 감싼다', () => {
    expect(ErrorUtil.resolveMessage(new Error('TypeError: x is not a function'))).toBe(
      TEXTS.errors.unexpected.description
    );
  });
});
