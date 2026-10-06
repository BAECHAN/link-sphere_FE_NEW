import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import {
  ImageUploadError,
  ImageUploadFailureReason,
  NetworkError,
} from '@/shared/types/common.type';

interface SignedUploadUrl {
  uploadUrl: string;
  token: string;
  publicUrl: string;
}

// Supabase Storage는 버킷 용량·형식 제한 위반도 HTTP 400으로 돌려주고 실제 원인은 본문 statusCode
// ("413"·"415")에 담는다. 혼잡(429)·장애(5xx, DB 타임아웃 544)는 HTTP 상태로 온다(storage 서버 소스
// 조사, docs/COMMENT.md "이미지 업로드 실패 안내" 참고). 본문이 없거나 JSON이 아니면 HTTP 상태로 판정한다.
async function resolveStorageFailureReason(response: Response): Promise<ImageUploadFailureReason> {
  const body: unknown = await response.json().catch(() => null);
  const bodyStatus =
    body && typeof body === 'object' && 'statusCode' in body ? Number(body.statusCode) : NaN;
  const status = Number.isNaN(bodyStatus) ? response.status : bodyStatus;

  if (status === 413) {
    return 'tooLarge';
  }

  if (status === 415) {
    return 'unsupportedType';
  }

  if (status === 429 || status >= 500) {
    return 'storageUnavailable';
  }

  return 'failed';
}

/**
 * 서명된 업로드 URL 발급 + 스토리지 직접 업로드를 담당하는 범용 API.
 * 백엔드는 용도(아바타/댓글 이미지 등)를 구분하지 않는 단일 엔드포인트만 제공하고,
 * 리사이즈 등 용도별 정책은 이 API를 감싸는 `shared/lib/upload/uploadImageAndGetUrl`이 처리한다.
 * 직접 호출하지 말고 그쪽을 거친다.
 */
export const uploadApi = {
  /** 업로드할 파일 확장자로 서명된 업로드 URL을 발급받는다 */
  getSignedUploadUrl: async (fileExtension: string): Promise<SignedUploadUrl> => {
    return await apiClient.post<SignedUploadUrl>(API_ENDPOINTS.upload.signedUrl, { fileExtension });
  },

  /**
   * 발급받은 서명 URL로 파일을 스토리지에 직접 업로드한다.
   * 대상이 우리 백엔드가 아니라 스토리지이므로 `apiClient`(인증 헤더/인터셉터)를 쓰지 않고
   * 서명 토큰만으로 직접 fetch한다 - API 레이어를 건너뛴 게 아니다.
   */
  uploadFileDirectly: async (signed: SignedUploadUrl, file: File): Promise<void> => {
    const response = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: {
        apikey: signed.token,
        Authorization: `Bearer ${signed.token}`,
        'Content-Type': file.type || 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
      },
      body: file,
    }).catch(() => {
      throw new NetworkError();
    });
    if (!response.ok) {
      throw new ImageUploadError(await resolveStorageFailureReason(response));
    }
  },
};
