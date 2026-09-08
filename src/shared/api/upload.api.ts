import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import { UserFacingError } from '@/shared/types/common.type';

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
      throw new UserFacingError(TEXTS.messages.error.avatarUploadFailed);
    }
  },
};
