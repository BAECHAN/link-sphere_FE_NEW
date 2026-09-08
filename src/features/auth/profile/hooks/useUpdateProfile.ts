import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateAccountSchema, UpdateAccount } from '@/shared/types/auth.type';
import { useUpdateAccountMutation } from '@/entities/user/api/auth.queries';
import { authApi } from '@/entities/user/api/auth.api';
import { useAccount } from '@/entities/user/hooks/useAccount';
import { useMyPageModalStore } from '@/shared/store/mypage.store';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { getImageFileSizeError } from '@/shared/lib/image/resizeImage';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';

type NicknameStatus = 'idle' | 'checking' | 'available' | 'duplicate';

export function useUpdateProfile(onSuccess?: () => void) {
  const { account } = useAccount();
  const { mutate: updateAccount, isPending } = useUpdateAccountMutation();

  // 저장 실패 후 "다시 열기"로 재오픈된 경우 시도했던 값을 복원한다. 모달은 닫힐 때 언마운트되므로
  // 재오픈은 항상 새 마운트다 - 아래 useState/useRef 초기값들은 최초 렌더 시점 값만 읽으므로
  // 이후 restoreValues가 바뀌어도(정상 흐름에선 일어나지 않는다) 영향받지 않는다.
  const restoreValues = useMyPageModalStore((state) => state.restoreValues);

  const form = useForm<UpdateAccount>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      nickname: restoreValues?.nickname ?? account?.nickname ?? '',
      image: restoreValues?.imagePreview ?? account?.image,
    },
    mode: 'onChange',
  });

  const { reset } = form;
  useEffect(() => {
    // 재오픈으로 복원된 값이 있으면 account 동기화가 그 값을 덮어쓰지 않게 한다
    if (account && !restoreValues) {
      reset({ nickname: account.nickname ?? '', image: account.image });
    }
  }, [account, reset, restoreValues]);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    restoreValues?.imagePreview ?? account?.image ?? null
  );
  const [pendingFile, setPendingFile] = useState<File | null>(restoreValues?.pendingFile ?? null);
  const objectUrlRef = useRef<string | null>(restoreValues?.imagePreview ?? null);
  // 제출과 함께 mutation에 넘긴 blob URL - 성공 시 mutation의 onSuccess가 해제하므로
  // 언마운트 정리에서는 건너뛴다 (제출되지 않고 남은 blob만 여기서 정리)
  const submittedObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (account?.image && !pendingFile) {
      setAvatarPreview(account.image);
    }
  }, [account?.image, pendingFile]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current && objectUrlRef.current !== submittedObjectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleAvatarChange = (file: File) => {
    // 업로드(제출) 시점까지 기다리지 않고 파일을 고르는 즉시 크기를 검증한다 - useImageAttachments.ts가
    // 댓글 이미지 첨부에서 쓰는 것과 동일한 fail-fast 패턴. resizeImageFile과 같은 기준을
    // 쓰므로(skipGifResize: false - 아바타는 항상 작게 표시됨) 실제 업로드 단계와 판정이 어긋나지 않는다.
    const sizeError = getImageFileSizeError(file, { skipGifResize: false });
    if (sizeError) {
      toast.error(sizeError);
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPendingFile(file);
    setAvatarPreview(objectUrl);
  };

  // 닉네임 중복은 제출 후 409로 복구하기보다 타이핑을 멈춘 뒤(디바운스) 미리 막는다 - GitHub·X·
  // Discord·Bluesky 등이 쓰는 방식. blur 트리거는 "저장 버튼 클릭이 blur를 먼저 유발해 검사가 끝나기
  // 전에 제출되는" 레이스가 있었다. 디바운스는 상태 변화가 매 키 입력마다(클릭보다 훨씬 전에) 일어나
  // 저장 버튼이 렌더 시점에 이미 disabled로 그려져 있으므로 이 레이스가 구조적으로 생기지 않는다
  // (Bluesky StepHandle의 hasDebounceSettled/isNotReady 패턴).
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');
  const checkedNicknameRef = useRef<string | null>(account?.nickname ?? null);
  const watchedNickname = form.watch('nickname');
  const debouncedNickname = useDebounce(watchedNickname, 500);
  const hasDebounceSettled = watchedNickname === debouncedNickname;

  useEffect(() => {
    const nickname = debouncedNickname.trim();

    // 원래 자기 닉네임으로 되돌아온 경우 - 실제로 바뀐 게 없으니 검사도, 상태 메시지도 필요 없다.
    // (예: A로 바꿔 확인까지 마친 뒤 다시 원래 값으로 되돌리면, checkedNicknameRef는 이미 A라서
    // 이 분기 없이는 원래 값을 "새로 확인할 값"으로 오인해 불필요하게 재조회하고 "사용 가능한
    // 닉네임입니다"라는 오해의 소지가 있는 메시지를 보여주게 된다)
    if (!nickname || nickname === account?.nickname) {
      setNicknameStatus('idle');
      form.clearErrors('nickname');
      checkedNicknameRef.current = account?.nickname ?? null;
      return;
    }
    if (nickname === checkedNicknameRef.current) {
      return;
    }
    if (form.getFieldState('nickname').invalid) {
      // 형식 오류(zod 정규식)가 이미 떠 있으면 서버까지 갈 필요 없음
      return;
    }

    let cancelled = false;
    setNicknameStatus('checking');
    void (async () => {
      let available: boolean;
      try {
        available = await authApi.checkNicknameAvailability(nickname);
      } catch {
        // 조회 자체가 실패했다(네트워크 오류·구 BE 미지원 등) - 저장을 막지는 않지만("사용
        // 가능"인지 실제로 확인된 게 아니므로) 확인됐다고 속이지도 않는다. idle로 두면 버튼은
        // 비활성화되지 않으면서(hasNicknameError=false) 초록 확인 메시지도 안 뜬다 - 실제
        // 중복이면 저장 시점에 BE가 409로 다시 막아준다.
        if (!cancelled) {
          setNicknameStatus('idle');
        }
        return;
      }
      if (cancelled) {
        // 검사 도중 값이 또 바뀌어 새 effect가 떴다 - 낡은 응답이므로 버린다
        return;
      }

      checkedNicknameRef.current = nickname;
      if (available) {
        setNicknameStatus('available');
        form.clearErrors('nickname');
      } else {
        setNicknameStatus('duplicate');
        form.setError('nickname', {
          type: 'manual',
          message: TEXTS.messages.error.nicknameDuplicate,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedNickname, account?.nickname, form]);

  const onSubmit = form.handleSubmit((formData) => {
    const previewUrl = pendingFile ? (objectUrlRef.current ?? undefined) : undefined;
    submittedObjectUrlRef.current = previewUrl ?? null;
    setPendingFile(null);

    // 서버 응답을 기다리지 않고 즉시 모달을 닫는다 - 낙관적 업데이트가 캐시를 바로 반영하므로
    // 여기서 기다릴 이유가 없다 (실패 시 캐시 쪽에서 롤백 + 재오픈 토스트로 처리한다).
    onSuccess?.();

    updateAccount({
      nickname: formData.nickname,
      image: formData.image ?? undefined,
      file: pendingFile ?? undefined,
      previewUrl,
    });
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
    isDirty: form.formState.isDirty || pendingFile !== null,
    account,
  };
}
