import { useState, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  nicknameValidationSchema,
  updateAccountSchema,
  UpdateAccount,
} from '@/entities/account/model/account.schema';
import { useUpdateAccountMutation } from '@/entities/account/api/account.queries';
import { accountApi } from '@/entities/account/api/account.api';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { getImageFileSizeError } from '@/shared/lib/image/resizeImage';
import { isAllowedImageType } from '@/shared/lib/image/imageFormat';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';

type NicknameStatus = 'idle' | 'checking' | 'available' | 'duplicate';

/** 고른 아바타 파일과 그 미리보기 blob URL - 함께 생기고 함께 사라진다 */
interface PendingAvatar {
  file: File;
  previewUrl: string;
}

export function useUpdateAccount() {
  const { account } = useAccount();
  const { mutate: updateAccount, isPending } = useUpdateAccountMutation();

  const form = useForm<UpdateAccount>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      nickname: account?.nickname ?? '',
      image: account?.image,
    },
    mode: 'onChange',
  });

  const { reset } = form;
  // 페이지 진입 시 account가 아직 없다가 뒤늦게 도착하는 경우(새로고침 등)에만 1회
  // 하이드레이션한다 - 매 account 변경마다 reset하면 다른 탭에서 프로필을 바꾼 뒤 돌아왔을
  // 때 사용자가 지금 입력 중인 값(아직 저장 안 한 닉네임 등)을 조용히 덮어쓰게 된다.
  const hydratedRef = useRef(account !== undefined);
  useEffect(
    function hydrateFormOnce() {
      if (account && !hydratedRef.current) {
        hydratedRef.current = true;
        reset({ nickname: account.nickname ?? '', image: account.image });
      }
    },
    [account, reset]
  );

  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);
  // 서버 이미지를 state에 복사해 두지 않고 렌더 중에 고른다 - 고른 파일이 있으면 그 미리보기, 없으면
  // 계정 이미지. 복사본을 effect로 따라가게 하면 계정이 늦게 올 때 낡은 값으로 한 번 더 그린다
  // (https://react.dev/learn/choosing-the-state-structure#avoid-redundant-state)
  const avatarPreview = pendingAvatar?.previewUrl ?? account?.image ?? null;

  useEffect(
    function revokeReplacedAvatarPreview() {
      if (!pendingAvatar) {
        return;
      }

      // 다른 파일로 바꾸거나 화면을 떠나면 해제한다. 저장에 성공하면 mutation의 onSuccess가 먼저
      // 해제하고, 이미 해제된 URL을 다시 해제하면 조용히 아무 일도 하지 않는다
      // (W3C File API revokeObjectURL 4단계, https://w3c.github.io/FileAPI/#dfn-revokeObjectURL)
      return () => URL.revokeObjectURL(pendingAvatar.previewUrl);
    },
    [pendingAvatar]
  );

  const handleAvatarChange = (file: File) => {
    // 형식도 고르는 즉시 본다 - 예전엔 검사가 없어 허용 목록 밖 형식이 제출 뒤 "프로필 업데이트에
    // 실패했어요"로만 보였다. 댓글 첨부(useImageAttachments.ts)와 같은 허용 목록을 쓴다.
    if (!isAllowedImageType(file.type)) {
      toast.error(TEXTS.validation.imageFileOnly);
      return;
    }

    // 업로드(제출) 시점까지 기다리지 않고 파일을 고르는 즉시 크기를 검증한다 - useImageAttachments.ts가
    // 댓글 이미지 첨부에서 쓰는 것과 동일한 fail-fast 패턴. resizeImageFile과 같은 기준을
    // 쓰므로(skipGifResize: false - 아바타는 항상 작게 표시됨) 실제 업로드 단계와 판정이 어긋나지 않는다.
    const sizeError = getImageFileSizeError(file, { skipGifResize: false });
    if (sizeError) {
      toast.error(sizeError);
      return;
    }

    // 앞서 고른 파일의 미리보기는 revokeReplacedAvatarPreview가 해제한다
    setPendingAvatar({ file, previewUrl: URL.createObjectURL(file) });
  };

  // 닉네임 중복은 제출 후 409로 복구하기보다 타이핑을 멈춘 뒤(디바운스) 미리 막는다 - GitHub·X·
  // Discord·Bluesky 등이 쓰는 방식. blur 트리거는 "저장 버튼 클릭이 blur를 먼저 유발해 검사가 끝나기
  // 전에 제출되는" 레이스가 있었다. 디바운스는 상태 변화가 매 키 입력마다(클릭보다 훨씬 전에) 일어나
  // 저장 버튼이 렌더 시점에 이미 disabled로 그려져 있으므로 이 레이스가 구조적으로 생기지 않는다
  // (Bluesky StepHandle의 hasDebounceSettled/isNotReady 패턴).
  // 마지막으로 조회를 마친 닉네임과 그 결과. 화면에 보이는 상태는 아래에서 렌더 중에 파생한다 - effect
  // 안에서 'idle'/'checking'을 바로 넣으면 낡은 상태로 한 번 더 렌더된다(가입 화면 useAvailabilityCheck.ts와
  // 같은 형태, https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect)
  const [nicknameResult, setNicknameResult] = useState<{
    value: string;
    status: Exclude<NicknameStatus, 'checking'>;
  } | null>(null);
  const checkedNicknameRef = useRef<string | null>(account?.nickname ?? null);
  const watchedNickname = useWatch({ control: form.control, name: 'nickname' });
  const debouncedNickname = useDebounce(watchedNickname, 500);
  const hasDebounceSettled = watchedNickname === debouncedNickname;

  const nickname = debouncedNickname.trim();
  // 원래 자기 닉네임으로 되돌아온 경우 - 실제로 바뀐 게 없으니 검사도, 상태 메시지도 필요 없다.
  // (예: A로 바꿔 확인까지 마친 뒤 다시 원래 값으로 되돌리면, checkedNicknameRef는 이미 A라서
  // 이 분기 없이는 원래 값을 "새로 확인할 값"으로 오인해 불필요하게 재조회하고 "사용 가능한
  // 닉네임입니다"라는 오해의 소지가 있는 메시지를 보여주게 된다)
  const isOwnNickname = !nickname || nickname === account?.nickname;
  // 형식 오류(zod 정규식)는 리졸버가 입력칸에 띄우니 서버까지 갈 필요 없음
  const isCheckable = !isOwnNickname && nicknameValidationSchema.safeParse(nickname).success;

  // 자기 닉네임으로 돌아오면 이전 결과를 버린다 - 다시 바꾸면 처음부터 확인한다
  if (isOwnNickname && nicknameResult !== null) {
    setNicknameResult(null);
  }

  const nicknameStatus: NicknameStatus = !isCheckable
    ? 'idle'
    : nicknameResult?.value === nickname
      ? nicknameResult.status
      : 'checking';

  useEffect(
    function checkNicknameAvailability() {
      if (isOwnNickname) {
        form.clearErrors('nickname');
        checkedNicknameRef.current = account?.nickname ?? null;
        return;
      }
      if (!isCheckable || nickname === checkedNicknameRef.current) {
        return;
      }

      let cancelled = false;
      void (async () => {
        let available: boolean;
        try {
          available = await accountApi.checkNicknameAvailability(nickname);
        } catch {
          // 조회 자체가 실패했다(네트워크 오류·구 BE 미지원 등) - 저장을 막지는 않지만("사용
          // 가능"인지 실제로 확인된 게 아니므로) 확인됐다고 속이지도 않는다. idle로 두면 버튼은
          // 비활성화되지 않으면서(hasNicknameError=false) 초록 확인 메시지도 안 뜬다 - 실제
          // 중복이면 저장 시점에 BE가 409로 다시 막아준다.
          if (!cancelled) {
            setNicknameResult({ value: nickname, status: 'idle' });
          }
          return;
        }
        if (cancelled) {
          // 검사 도중 값이 또 바뀌어 새 effect가 떴다 - 낡은 응답이므로 버린다
          return;
        }

        checkedNicknameRef.current = nickname;
        if (available) {
          setNicknameResult({ value: nickname, status: 'available' });
          form.clearErrors('nickname');
        } else {
          setNicknameResult({ value: nickname, status: 'duplicate' });
          form.setError('nickname', {
            type: 'manual',
            message: TEXTS.messages.error.nicknameDuplicate,
          });
        }
      })();

      return () => {
        cancelled = true;
      };
    },
    [nickname, isOwnNickname, isCheckable, account?.nickname, form]
  );

  const onSubmit = form.handleSubmit((formData) => {
    updateAccount(
      {
        nickname: formData.nickname,
        image: formData.image ?? undefined,
        file: pendingAvatar?.file,
        previewUrl: pendingAvatar?.previewUrl,
      },
      {
        onSuccess: (data) => {
          setPendingAvatar(null);
          reset({ nickname: data.nickname ?? '', image: data.image });
        },
        onError: () => {
          // 아무것도 안 건드린다 - 닉네임·고른 파일·미리보기 그대로 유지돼 바로 재시도 가능
        },
      }
    );
  });

  return {
    form,
    avatarPreview,
    handleAvatarChange,
    onSubmit,
    isPending,
    isCheckingNickname: nicknameStatus === 'checking',
    isNicknameAvailable: nicknameStatus === 'available',
    hasNicknameError: nicknameStatus === 'duplicate',
    hasDebounceSettled,
    isDirty: form.formState.isDirty || pendingAvatar !== null,
    account,
  };
}
