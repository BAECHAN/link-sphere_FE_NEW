import { useFetchLinkPreviewQuery } from '@/entities/post/api/post.queries';
import { createPostSchema, LinkPreview } from '@/entities/post/model/post.schema';
import { PostUtil } from '@/entities/post/utils/post.util';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { ApiError } from '@/shared/types/common.type';
import { UrlUtil } from '@/shared/utils/url.util';

/** 입력을 멈춘 뒤 이만큼 기다렸다가 묻는다 - 가입 화면 중복 확인(useAvailabilityCheck)과 같은 값 */
const PREVIEW_DEBOUNCE_MS = 500;

/**
 * - idle: 조회하지 않음(빈 값·형식 오류·조회 끔)
 * - loading / ready / failed: 카드 자리의 세 가지 모습
 * - urlError: 서버가 URL 자체를 거절함(도메인 없음 등) - 카드 대신 URL 칸 에러로 보여줄 문구
 */
export type LinkPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; preview: LinkPreview }
  | { status: 'failed' }
  | { status: 'urlError'; message: string };

/**
 * 등록·수정 폼의 작성 중 링크 미리보기. 입력이 0.5초 멈추고 형식이 맞을 때만 서버에 묻는다.
 * 등록 요청과 같은 정규화(UrlUtil.normalizeUrl)를 거친 URL로 물어야 BE 캐시(10분)가 등록 때
 * 재사용된다 - 그래서 저장되는 글이 사용자가 본 미리보기와 같아진다.
 *
 * @param rawUrl - 폼의 URL 입력값 그대로
 * @param enabled - 호출부의 추가 조건(이메일 인증됨, 수정 폼이면 URL을 바꿨을 때만 등)
 */
export function useLinkPreview(rawUrl: string, enabled: boolean): LinkPreviewState {
  const currentUrl = rawUrl.trim();
  const debouncedUrl = useDebounce(currentUrl, PREVIEW_DEBOUNCE_MS);
  // 입력이 멈추기 전에는 debouncedUrl이 직전 값이다 - 그 값으로 물으면 수정 폼에서 URL을 바꾸는 순간
  // 원래 URL을 한 번 더 크롤링하고 옛 카드를 보여준다
  const isSettled = debouncedUrl === currentUrl;
  const isValid = debouncedUrl !== '' && createPostSchema.shape.url.safeParse(debouncedUrl).success;
  const url = isValid ? UrlUtil.normalizeUrl(debouncedUrl) : '';
  const shouldFetch = enabled && isSettled && isValid;

  const { data, error, isFetching } = useFetchLinkPreviewQuery(url, shouldFetch);

  if (!shouldFetch) {
    return { status: 'idle' };
  }

  if (isFetching) {
    return { status: 'loading' };
  }

  if (error) {
    // 도메인 없음·내부망·형식 같은 URL 자체의 문제는 등록해도 똑같이 실패하므로 등록 전에
    // URL 칸에서 고치게 한다. 그 외(한도·서버 오류 등)는 미리보기만 못 보여줄 뿐 등록은 된다.
    const resolution =
      error instanceof ApiError
        ? PostUtil.resolveSubmitError(error, { mode: 'create', hasFolders: false })
        : null;

    if (resolution?.kind === 'field' && resolution.field === 'url') {
      return { status: 'urlError', message: resolution.message };
    }

    return { status: 'failed' };
  }

  if (data) {
    return { status: 'ready', preview: data };
  }

  return { status: 'loading' };
}
