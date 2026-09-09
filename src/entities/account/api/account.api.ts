import { apiClient } from '@/shared/api/client';
import { Account, UpdateAccount } from '@/entities/account/model/account.schema';
import { API_ENDPOINTS } from '@/shared/config/api';
import { uploadImageAndGetUrl } from '@/shared/lib/upload/uploadImageAndGetUrl';

export const accountApi = {
  fetchAccount: async (): Promise<Account> => {
    const response = await apiClient.get<Account>(API_ENDPOINTS.auth.account);
    return response;
  },

  // 새 아바타 파일이 있으면 먼저 스토리지에 업로드해 URL을 얻은 뒤 계정을 갱신한다
  // (comment.api.ts의 createComment/updateComment와 동일한 "이미지 선업로드 후 본 요청" 형태)
  updateAccount: async (payload: UpdateAccount & { file?: File }): Promise<Account> => {
    // 아바타는 항상 48~160px 고정 크기로만 표시되므로 GIF도 정지 이미지로 통일한다 - 애니메이션을
    // 지켜도 표시 단계에서 체감할 실익이 없다(resizeImage.ts 참고). SVG는 옵션과 무관하게 원본 유지.
    const image = payload.file
      ? await uploadImageAndGetUrl(payload.file, 512, { skipGifResize: false })
      : payload.image;
    const response = await apiClient.patch<Account>(API_ENDPOINTS.auth.updateAccount, {
      nickname: payload.nickname,
      image,
    });
    return response;
  },

  /**
   * 닉네임 가용성 사전 조회. 조회 자체의 성공·실패만 판단하고 fail-open 여부는 호출부
   * (useUpdateAccount.ts)에서 결정한다 - 여기서 실패를 삼켜 true로 흡수하면 "네트워크가 끊겨
   * 확인을 못 한 것"과 "실제로 확인해서 사용 가능한 것"을 호출부가 구분할 수 없게 된다.
   */
  checkNicknameAvailability: async (nickname: string): Promise<boolean> => {
    const response = await apiClient.get<{ available: boolean }>(
      API_ENDPOINTS.auth.nicknameAvailability,
      { searchParams: { nickname } }
    );
    return response.available;
  },
};
