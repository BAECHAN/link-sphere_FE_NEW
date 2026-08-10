import { useRef } from 'react';
import { FormProvider } from 'react-hook-form';
import { Camera } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { TEXTS } from '@/shared/config/texts';
import { useUpdateProfile } from '@/features/auth/profile/hooks/useUpdateProfile';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { UserAvatar } from '@/entities/user/ui/UserAvatar';

interface UpdateProfileFormProps {
  onSuccess?: () => void;
}

export function UpdateProfileForm({ onSuccess }: UpdateProfileFormProps) {
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
  } = useUpdateProfile(onSuccess);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 체크가 빨리 끝나면(대부분의 경우) "확인 중..."이 깜빡이지 않도록 300ms 지연 후에만 보여준다
  const showChecking = useDelayedLoading(isCheckingNickname, 300);
  const nicknameStatusText = showChecking
    ? TEXTS.mypage.checkingNickname
    : isNicknameAvailable
      ? TEXTS.mypage.nicknameAvailable
      : undefined;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label={TEXTS.mypage.changeImage}
          >
            <UserAvatar
              image={avatarPreview}
              nickname={account?.nickname}
              size="lg"
              className="text-xl"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="text-white h-5 w-5" />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
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
          description={nicknameStatusText}
          descriptionVariant={isNicknameAvailable ? 'success' : 'default'}
          messageInLabelRow
        />

        <TooltipWrapper
          content={
            !isDirty
              ? TEXTS.validation.noChanges
              : !hasDebounceSettled || isCheckingNickname
                ? TEXTS.validation.nicknameChecking
                : null
          }
          className="w-full"
        >
          <Button
            type="submit"
            className="w-full"
            disabled={
              isPending ||
              !isDirty ||
              !hasDebounceSettled ||
              isCheckingNickname ||
              // 닉네임 형식 오류(길이·문자 규칙)까지 포함해서 막는다 - 중복 체크(hasNicknameError)만
              // 보면 형식 오류일 때는 버튼이 멀쩡해 보이는데 눌러도 RHF가 내부적으로 제출을 막아
              // 아무 반응이 없는 것처럼 보였다.
              !!form.formState.errors.nickname
            }
          >
            {TEXTS.mypage.save}
          </Button>
        </TooltipWrapper>
      </form>
    </FormProvider>
  );
}
