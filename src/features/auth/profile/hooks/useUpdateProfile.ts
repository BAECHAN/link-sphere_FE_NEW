import { useState, useEffect, useCallback } from 'react';
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

  // ===== DEBUG: 임시 진단 로그 (원인 확인 후 제거) =====
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const addDebug = useCallback((msg: string) => {
    const t = new Date().toISOString().slice(11, 23);
    setDebugLog((prev) => [...prev, `[${t}] ${msg}`]);
  }, []);
  useEffect(() => {
    addDebug(`UA: ${navigator.userAgent}`);
  }, [addDebug]);
  // ===== /DEBUG =====

  useEffect(() => {
    if (account?.image && !pendingFile) {
      setAvatarPreview(account.image);
    }
  }, [account?.image, pendingFile]);

  const handleAvatarChange = (file: File) => {
    setPendingFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    // DEBUG: selected file meta + actual bytes readability
    addDebug(
      `select: name=${file.name} size=${file.size}B type=${file.type || '(none)'} lastMod=${file.lastModified}`
    );
    file
      .arrayBuffer()
      .then((buf) => addDebug(`bytes-read OK: ${buf.byteLength}B`))
      .catch((err) =>
        addDebug(`bytes-read FAIL: ${err instanceof Error ? err.message : String(err)}`)
      );
  };

  const onSubmit = form.handleSubmit(async (formData) => {
    // DEBUG
    addDebug(
      `submit: pendingFile=${pendingFile ? `${pendingFile.name}/${pendingFile.size}B` : 'NULL'}`
    );
    let imageUrl = formData.image ?? undefined;
    try {
      if (pendingFile) {
        addDebug('uploadAvatar start...');
        const result = await uploadAvatar(pendingFile);
        imageUrl = result.imageUrl;
        addDebug(`uploadAvatar OK: ${imageUrl}`);
      } else {
        addDebug('pendingFile NULL -> skip upload');
      }
      addDebug(`updateAccount call image=${imageUrl ?? 'undefined'}`);
      await updateAccount({ nickname: formData.nickname, image: imageUrl });
      addDebug('updateAccount OK');
      setPendingFile(null);
      onSuccess?.();
    } catch (e) {
      addDebug(`ERROR: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    }
  });

  return {
    form,
    avatarPreview,
    handleAvatarChange,
    onSubmit,
    isPending: isUploading || isUpdating,
    isDirty: form.formState.isDirty || pendingFile !== null,
    account,
    debugLog, // DEBUG
  };
}
