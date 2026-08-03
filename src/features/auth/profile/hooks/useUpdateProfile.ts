import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateAccountSchema, UpdateAccount } from '@/shared/types/auth.type';
import {
  useUpdateAccountMutation,
  useUploadAvatarMutation,
} from '@/entities/user/api/auth.queries';
import { useAccount } from '@/entities/user/hooks/useAccount';

export function useUpdateProfile(onSuccess?: () => void) {
  const { account } = useAccount();
  const { mutateAsync: uploadAvatar, isPending: isUploading } = useUploadAvatarMutation();
  const { mutateAsync: updateAccount, isPending: isUpdating } = useUpdateAccountMutation();

  const form = useForm<UpdateAccount>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: { nickname: account?.nickname ?? '', image: account?.image },
    mode: 'onChange',
  });

  const { reset } = form;
  useEffect(() => {
    if (account) {
      reset({ nickname: account.nickname ?? '', image: account.image });
    }
  }, [account, reset]);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(account?.image ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (account?.image && !pendingFile) {
      setAvatarPreview(account.image);
    }
  }, [account?.image, pendingFile]);

  // 선택했지만 제출하지 않고 다른 파일로 바꾸거나 폼을 닫는 경우 blob URL이 누적되므로 정리한다
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleAvatarChange = (file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPendingFile(file);
    setAvatarPreview(objectUrl);
  };

  const onSubmit = form.handleSubmit(async (formData) => {
    let imageUrl = formData.image ?? undefined;
    if (pendingFile) {
      const result = await uploadAvatar(pendingFile);
      imageUrl = result.imageUrl;
    }
    await updateAccount({ nickname: formData.nickname, image: imageUrl });
    setPendingFile(null);
    onSuccess?.();
  });

  return {
    form,
    avatarPreview,
    handleAvatarChange,
    onSubmit,
    isPending: isUploading || isUpdating,
    isDirty: form.formState.isDirty || pendingFile !== null,
    account,
  };
}
