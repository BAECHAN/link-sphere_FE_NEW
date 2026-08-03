import { useRef } from 'react';
import { FormProvider } from 'react-hook-form';
import { Camera } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { TEXTS } from '@/shared/config/texts';
import { useUpdateProfile } from '@/features/auth/profile/hooks/useUpdateProfile';
import { UserAvatar } from '@/entities/user/ui/UserAvatar';

interface UpdateProfileFormProps {
  onSuccess?: () => void;
}

export function UpdateProfileForm({ onSuccess }: UpdateProfileFormProps) {
  const { form, avatarPreview, handleAvatarChange, onSubmit, isPending, isDirty, account } =
    useUpdateProfile(onSuccess);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
          disabled={isPending}
        />

        <Button type="submit" className="w-full" disabled={isPending || !isDirty}>
          {isPending ? TEXTS.mypage.saving : TEXTS.mypage.save}
        </Button>
      </form>
    </FormProvider>
  );
}
