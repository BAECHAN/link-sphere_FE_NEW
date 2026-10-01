import { useRef } from 'react';
import { FormProvider } from 'react-hook-form';
import { Camera } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { TEXTS } from '@/shared/config/texts';
import { useUpdateAccount } from '@/features/account/update/hooks/useUpdateAccount';
import { useAvailabilityMessage } from '@/shared/hooks/useAvailabilityMessage';
import { UserAvatar } from '@/entities/user/ui/UserAvatar';

export function UpdateAccountForm() {
  const {
    form,
    avatarPreview,
    handleAvatarChange,
    onSubmit,
    isPending,
    isCheckingNickname,
    isNicknameAvailable,
    hasDebounceSettled,
    isDirty,
    account,
  } = useUpdateAccount();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const nicknameMessage = useAvailabilityMessage({
    isChecking: isCheckingNickname,
    isAvailable: isNicknameAvailable,
    checkingText: TEXTS.mypage.checkingNickname,
    availableText: TEXTS.mypage.nicknameAvailable,
    hintText: TEXTS.mypage.nicknameHint,
  });

  const isSaveDisabled =
    isPending ||
    !isDirty ||
    !hasDebounceSettled ||
    isCheckingNickname ||
    // 닉네임 형식 오류(길이·문자 규칙)까지 포함해서 막는다 - 중복 체크(hasNicknameError)만
    // 보면 형식 오류일 때는 버튼이 멀쩡해 보이는데 눌러도 RHF가 내부적으로 제출을 막아
    // 아무 반응이 없는 것처럼 보였다.
    !!form.formState.errors.nickname;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            className="relative rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            aria-label={TEXTS.mypage.changeImage}
          >
            <UserAvatar
              image={avatarPreview}
              nickname={account?.nickname}
              size="lg"
              className="text-xl"
            />
            <div className="absolute inset-0 rounded-full bg-scrim/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="text-scrim-foreground h-5 w-5" />
            </div>
          </button>
          <span className="text-sm font-medium">{account?.nickname}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleAvatarChange(file);
              }
              e.target.value = '';
            }}
          />
        </div>

        <FormInput
          name="nickname"
          label={TEXTS.labels.nickname}
          placeholder={TEXTS.placeholders.nickname}
          description={nicknameMessage.description}
          descriptionVariant={nicknameMessage.descriptionVariant}
          enterKeyHint="done"
          disabled={isPending}
          required
        />

        <TooltipWrapper
          content={!isDirty ? TEXTS.validation.noChanges : null}
          disabled={isSaveDisabled}
          className="w-full"
        >
          <Button type="submit" className="w-full h-11" disabled={isSaveDisabled}>
            {isPending ? TEXTS.common.saving : TEXTS.mypage.save}
          </Button>
        </TooltipWrapper>
      </form>
    </FormProvider>
  );
}
