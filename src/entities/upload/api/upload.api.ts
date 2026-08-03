import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import { resizeImageFile } from '@/shared/lib/image/resizeImage';

interface SignedUploadUrl {
  uploadUrl: string;
  token: string;
  publicUrl: string;
}

export const uploadApi = {
  getSignedUploadUrl: async (fileExtension: string): Promise<SignedUploadUrl> => {
    return await apiClient.post<SignedUploadUrl>(API_ENDPOINTS.upload.signedUrl, { fileExtension });
  },

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
    });
    if (!response.ok) {
      throw new Error(TEXTS.messages.error.avatarUploadFailed);
    }
  },
};

/**
 * 파일을 리사이즈한 뒤 스토리지에 직접 업로드하고 공개 URL을 반환한다
 * (백엔드는 서명 URL 발급만 담당). maxDimension은 용도별 상한(아바타 512, 댓글 이미지 1024).
 */
export async function uploadImageAndGetUrl(file: File, maxDimension = 1024): Promise<string> {
  const resized = await resizeImageFile(file, maxDimension);
  const extension = resized.name.split('.').pop() || 'bin';
  const signed = await uploadApi.getSignedUploadUrl(extension);
  await uploadApi.uploadFileDirectly(signed, resized);
  return signed.publicUrl;
}
