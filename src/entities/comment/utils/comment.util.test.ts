import { describe, it, expect } from 'vitest';
import {
  ApiError,
  ImageUploadError,
  NetworkError,
  UserFacingError,
  type ApiErrorResponse,
} from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';
import { CommentUtil } from '@/entities/comment/utils/comment.util';
import {
  MAX_COMMENT_CONTENT_BYTES,
  MAX_COMMENT_CONTENT_HANGUL_CHARS,
} from '@/entities/comment/config/comment.const';

const MESSAGES = TEXTS.messages.error.commentSubmit;
const UPLOAD = TEXTS.messages.error.uploadSubmit;

function apiError(overrides: Partial<ApiErrorResponse>): ApiError {
  return new ApiError({
    status: 400,
    code: 'X',
    message: 'internal english message',
    timestamp: '2026-10-05T00:00:00.000Z',
    ...overrides,
  });
}

describe('CommentUtil.resolveSubmitError', () => {
  it.each([
    [new ImageUploadError('unsupportedType'), UPLOAD.imageUnsupportedType],
    [new ImageUploadError('tooLarge'), UPLOAD.register.imageTooLarge],
    [new ImageUploadError('rateLimited', 1380), UPLOAD.register.imageRateLimitedIn(23)],
    [new ImageUploadError('rateLimited'), UPLOAD.register.imageRateLimited],
    [new ImageUploadError('storageUnavailable'), UPLOAD.register.storageUnavailable],
    [new ImageUploadError('network'), UPLOAD.register.network],
    [new ImageUploadError('failed'), MESSAGES.createFailed],
  ])('업로드 단계 실패(%s)는 원인별로 안내한다', (error, message) => {
    expect(CommentUtil.resolveSubmitError(error, 'create')).toBe(message);
  });

  it('수정 폼은 업로드 단계 실패 안내를 "저장" 문구로 끝맺는다', () => {
    expect(CommentUtil.resolveSubmitError(new ImageUploadError('tooLarge'), 'update')).toBe(
      UPLOAD.save.imageTooLarge
    );
  });

  it('업로드 한도의 대기 시간은 분 단위로 올림한다(61초 → 2분)', () => {
    expect(CommentUtil.resolveSubmitError(new ImageUploadError('rateLimited', 61), 'reply')).toBe(
      UPLOAD.register.imageRateLimitedIn(2)
    );
  });

  it('우리가 직접 던진 안내(UserFacingError)는 문구를 그대로 쓴다', () => {
    expect(CommentUtil.resolveSubmitError(new UserFacingError('이미지 용량 안내'), 'create')).toBe(
      '이미지 용량 안내'
    );
  });

  it('등록 요청이 응답 없이 끝나면(504·연결 끊김) 등록 여부부터 확인하게 한다', () => {
    expect(CommentUtil.resolveSubmitError(apiError({ status: 504 }), 'create')).toBe(
      MESSAGES.outcomeUnknown
    );
    expect(CommentUtil.resolveSubmitError(new NetworkError(), 'reply')).toBe(
      MESSAGES.outcomeUnknown
    );
  });

  it('수정 요청은 응답 없이 끝나도 다시 보내면 되므로 일반 안내를 쓴다', () => {
    expect(CommentUtil.resolveSubmitError(new NetworkError(), 'update')).toBe(UPLOAD.save.network);
    expect(CommentUtil.resolveSubmitError(apiError({ status: 504 }), 'update')).toBe(
      MESSAGES.updateFailed
    );
  });

  it('글이 삭제됐으면(POST_NOT_FOUND) 댓글을 달 수 없다고 안내한다', () => {
    expect(
      CommentUtil.resolveSubmitError(
        apiError({ status: 404, code: SERVER_ERROR_CODE.POST_NOT_FOUND }),
        'create'
      )
    ).toBe(MESSAGES.postDeleted);
  });

  it('COMMENT_NOT_FOUND는 답글이면 부모 댓글, 수정이면 그 댓글이 삭제된 것이다', () => {
    const error = apiError({ status: 404, code: SERVER_ERROR_CODE.COMMENT_NOT_FOUND });

    expect(CommentUtil.resolveSubmitError(error, 'reply')).toBe(MESSAGES.parentDeleted);
    expect(CommentUtil.resolveSubmitError(error, 'update')).toBe(MESSAGES.commentDeleted);
  });

  it('삭제된 댓글을 수정하면(COMMENT_DELETED) 수정할 수 없다고 안내한다', () => {
    expect(
      CommentUtil.resolveSubmitError(
        apiError({ status: 409, code: SERVER_ERROR_CODE.COMMENT_DELETED }),
        'update'
      )
    ).toBe(MESSAGES.commentDeleted);
  });

  it.each([
    [
      apiError({ status: 403, code: SERVER_ERROR_CODE.EMAIL_NOT_VERIFIED }),
      TEXTS.messages.error.emailVerificationRequired,
    ],
    [
      apiError({ status: 403, code: SERVER_ERROR_CODE.EDGE_BLOCKED }),
      TEXTS.messages.error.edgeBlocked,
    ],
    [
      apiError({ status: 401, code: SERVER_ERROR_CODE.NOT_LOGGED_IN }),
      TEXTS.messages.error.loginRequired,
    ],
    [apiError({ status: 429 }), TEXTS.messages.error.rateLimited],
  ])('기존 전역 안내와 같은 원인(%s)은 같은 문구를 쓴다', (error, message) => {
    expect(CommentUtil.resolveSubmitError(error, 'create')).toBe(message);
  });

  it('그 외 실패는 서버 message를 노출하지 않고 일반 안내를 쓴다', () => {
    const error = apiError({ status: 500, code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR });

    expect(CommentUtil.resolveSubmitError(error, 'create')).toBe(MESSAGES.createFailed);
    expect(CommentUtil.resolveSubmitError(error, 'update')).toBe(MESSAGES.updateFailed);
    expect(CommentUtil.resolveSubmitError(new Error('x is not a function'), 'create')).toBe(
      MESSAGES.createFailed
    );
  });
});

describe('CommentUtil.toLeftFormFailureDescription', () => {
  it('원인을 가려내지 못한 실패는 제목과 겹치는 문구 대신 할 일만 남긴다', () => {
    const retryLater = TEXTS.messages.error.leftPageFailure.retryLater;

    expect(CommentUtil.toLeftFormFailureDescription(MESSAGES.createFailed, 'create')).toBe(
      retryLater
    );
    expect(CommentUtil.toLeftFormFailureDescription(MESSAGES.createFailed, 'reply')).toBe(
      retryLater
    );
    expect(CommentUtil.toLeftFormFailureDescription(MESSAGES.updateFailed, 'update')).toBe(
      retryLater
    );
  });

  it('원인을 아는 실패는 머물렀을 때와 같은 문구를 쓴다', () => {
    expect(CommentUtil.toLeftFormFailureDescription(MESSAGES.outcomeUnknown, 'create')).toBe(
      MESSAGES.outcomeUnknown
    );
    expect(CommentUtil.toLeftFormFailureDescription(MESSAGES.commentDeleted, 'update')).toBe(
      MESSAGES.commentDeleted
    );
  });
});

describe('CommentUtil.isOutcomeUnknown', () => {
  it('연결 끊김과 504만 결과를 모르는 실패로 본다', () => {
    expect(CommentUtil.isOutcomeUnknown(new NetworkError())).toBe(true);
    expect(CommentUtil.isOutcomeUnknown(apiError({ status: 504 }))).toBe(true);
    expect(CommentUtil.isOutcomeUnknown(apiError({ status: 500 }))).toBe(false);
    expect(CommentUtil.isOutcomeUnknown(new ImageUploadError('network'))).toBe(false);
  });
});

describe('CommentUtil.countHangulEquivalentChars', () => {
  it.each([
    ['', 0],
    ['가', 1],
    ['abc', 1],
    ['abcd', 2],
    ['가a', 2],
    ['😀', 2],
  ])('%j → %i자(UTF-8 바이트 ÷ 3 올림)', (content, expected) => {
    expect(CommentUtil.countHangulEquivalentChars(content)).toBe(expected);
  });

  it.each([
    [MAX_COMMENT_CONTENT_BYTES - 1, MAX_COMMENT_CONTENT_HANGUL_CHARS],
    [MAX_COMMENT_CONTENT_BYTES, MAX_COMMENT_CONTENT_HANGUL_CHARS],
    [MAX_COMMENT_CONTENT_BYTES + 1, MAX_COMMENT_CONTENT_HANGUL_CHARS + 1],
  ])('%i바이트 → %i자', (bytes, expected) => {
    expect(CommentUtil.countHangulEquivalentChars('a'.repeat(bytes))).toBe(expected);
  });

  // 바이트 상한이 3의 배수가 아니게 바뀌면 글자 수는 상한 안인데 제출이 막히는 구간이 생긴다
  it.each([
    MAX_COMMENT_CONTENT_BYTES - 1,
    MAX_COMMENT_CONTENT_BYTES,
    MAX_COMMENT_CONTENT_BYTES + 1,
  ])('%i바이트에서 글자 수 초과 여부가 바이트 상한 초과 여부와 같다', (bytes) => {
    const count = CommentUtil.countHangulEquivalentChars('a'.repeat(bytes));

    expect(count > MAX_COMMENT_CONTENT_HANGUL_CHARS).toBe(bytes > MAX_COMMENT_CONTENT_BYTES);
  });
});
