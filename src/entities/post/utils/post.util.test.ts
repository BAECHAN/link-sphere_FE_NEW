import { describe, it, expect } from 'vitest';
import { ApiError, type ApiErrorResponse } from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';
import { PostUtil, type PostSubmitErrorContext } from '@/entities/post/utils/post.util';

const CREATE: PostSubmitErrorContext = { mode: 'create', hasFolders: false };
const CREATE_WITH_FOLDERS: PostSubmitErrorContext = { mode: 'create', hasFolders: true };
const UPDATE: PostSubmitErrorContext = { mode: 'update', hasFolders: false };
const MESSAGES = TEXTS.messages.error.postSubmit;

function apiError(overrides: Partial<ApiErrorResponse>, retryAfterSeconds?: number): ApiError {
  const error = new ApiError({
    status: 400,
    code: 'X',
    message: 'internal english message',
    timestamp: '2026-10-03T00:00:00.000Z',
    ...overrides,
  });
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

describe('PostUtil.resolveSubmitError', () => {
  it.each([
    [SERVER_ERROR_CODE.URL_UNRESOLVABLE, MESSAGES.urlUnresolvable],
    [SERVER_ERROR_CODE.URL_NOT_ALLOWED, MESSAGES.urlNotAllowed],
    [SERVER_ERROR_CODE.INVALID_URL, MESSAGES.urlInvalid],
    [SERVER_ERROR_CODE.INVALID_INPUT, MESSAGES.urlInvalid],
  ])('URL 코드 %s는 URL 칸 에러로 분류한다', (code, message) => {
    expect(PostUtil.resolveSubmitError(apiError({ code }), CREATE)).toEqual({
      kind: 'field',
      field: 'url',
      message,
    });
  });

  it('폴더가 사라졌으면(FOLDER_NOT_FOUND) 북마크 칸 에러로 분류한다', () => {
    expect(
      PostUtil.resolveSubmitError(
        apiError({ status: 404, code: SERVER_ERROR_CODE.FOLDER_NOT_FOUND }),
        CREATE_WITH_FOLDERS
      )
    ).toEqual({ kind: 'field', field: 'folderIds', message: MESSAGES.folderNotFound });
  });

  it('폴더를 고른 등록의 FORBIDDEN은 남의 폴더라 북마크 칸 에러, 수정의 FORBIDDEN은 권한 안내다', () => {
    const forbidden = apiError({ status: 403, code: SERVER_ERROR_CODE.FORBIDDEN });

    expect(PostUtil.resolveSubmitError(forbidden, CREATE_WITH_FOLDERS)).toMatchObject({
      kind: 'field',
      field: 'folderIds',
    });
    expect(PostUtil.resolveSubmitError(forbidden, UPDATE)).toEqual({
      kind: 'form',
      message: MESSAGES.notOwner,
    });
  });

  it('429는 Retry-After를 분으로 올림해 안내하고, 없으면 "잠시 후"로 안내한다', () => {
    expect(PostUtil.resolveSubmitError(apiError({ status: 429 }, 899), CREATE)).toEqual({
      kind: 'form',
      message: MESSAGES.rateLimitedIn(15),
    });
    expect(PostUtil.resolveSubmitError(apiError({ status: 429 }), CREATE)).toEqual({
      kind: 'form',
      message: MESSAGES.rateLimited,
    });
  });

  it('504는 이미 저장됐을 수 있어 피드 확인 링크를 함께 안내한다', () => {
    expect(PostUtil.resolveSubmitError(apiError({ status: 504, code: '504' }), CREATE)).toEqual({
      kind: 'form',
      message: MESSAGES.timeout,
      action: 'checkFeed',
    });
  });

  it.each([
    [SERVER_ERROR_CODE.EMAIL_NOT_VERIFIED, 403, TEXTS.messages.error.emailVerificationRequired],
    [SERVER_ERROR_CODE.EDGE_BLOCKED, 403, TEXTS.messages.error.edgeBlocked],
    [SERVER_ERROR_CODE.NOT_LOGGED_IN, 401, TEXTS.messages.error.loginRequired],
  ])('%s는 버튼 위 안내로 분류한다', (code, status, message) => {
    expect(PostUtil.resolveSubmitError(apiError({ status, code }), CREATE)).toEqual({
      kind: 'form',
      message,
    });
  });

  it('수정 중 글이 삭제됐으면(POST_NOT_FOUND) 삭제 안내를 한다', () => {
    expect(
      PostUtil.resolveSubmitError(
        apiError({ status: 404, code: SERVER_ERROR_CODE.POST_NOT_FOUND }),
        UPDATE
      )
    ).toEqual({ kind: 'form', message: MESSAGES.postDeleted });
  });

  it('네트워크 단절은 연결 확인 안내를 한다', () => {
    expect(PostUtil.resolveSubmitError(new TypeError('Failed to fetch'), CREATE)).toEqual({
      kind: 'form',
      message: MESSAGES.network,
    });
  });

  it('그 외 실패는 서버 메시지를 노출하지 않고 등록·수정별 일반 안내를 한다', () => {
    const serverError = apiError({ status: 500, code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR });

    expect(PostUtil.resolveSubmitError(serverError, CREATE)).toEqual({
      kind: 'form',
      message: MESSAGES.createFailed,
    });
    expect(PostUtil.resolveSubmitError(serverError, UPDATE)).toEqual({
      kind: 'form',
      message: MESSAGES.updateFailed,
    });
  });
});
