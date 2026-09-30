import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { useLoginMutation } from '@/entities/auth/api/auth.queries';
import { loginSchema } from '@/entities/auth/model/auth.schema';
import { z } from 'zod';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const SAVED_ID_KEY = STORAGE_KEYS.AUTH.SAVED_EMAIL;

const loginFormSchema = loginSchema.extend({
  saveEmail: z.boolean(),
});

type LoginFormInput = z.infer<typeof loginFormSchema>;

interface UseLoginOptions {
  /**
   * 사용자가 이메일·비밀번호를 기본값에서 바꿨는지(입력이 생겼는지) 알린다. 저장된 이메일로
   * 미리 채워진 값은 입력으로 보지 않는다. 로그인 모달이 입력이 있을 때 바깥 클릭으로 닫히지
   * 않게 하는 데 쓴다(docs/DECISIONS.md 2026-09-30 "바깥 클릭 닫기 정책").
   */
  onInputDirtyChange?: (dirty: boolean) => void;
}

interface UseLoginReturn {
  form: UseFormReturn<LoginFormInput>;
  onSubmit: (data: LoginFormInput) => Promise<void>;
  isPending: boolean;
}

// 회원가입 화면(이메일 중복 확인 또는 가입 성공)에서 넘어올 때 함께 실리는 이메일 -
// 방금 직접 입력하고 서버가 확인해준 값이라 저장된 이메일보다 우선한다.
interface LoginLocationState {
  email?: string;
}

export function useLogin({ onInputDirtyChange }: UseLoginOptions = {}): UseLoginReturn {
  const location = useLocation();
  const savedEmail = LocalStorageUtil.getItem<string>(SAVED_ID_KEY) || '';
  const emailFromState = (location.state as LoginLocationState | null)?.email;

  const form = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: emailFromState || savedEmail || '',
      password: '',
      saveEmail: !!savedEmail,
    },
  });

  const { mutateAsync: login, isPending } = useLoginMutation();

  // formState는 프록시라 렌더 중에 읽어야 변경을 구독한다. "이메일 저장" 체크박스는
  // 닫혀도 잃는 입력이 아니라 제외한다.
  const { dirtyFields } = form.formState;
  const hasUserInput = Boolean(dirtyFields.email || dirtyFields.password);

  useEffect(
    function reportInputDirty() {
      onInputDirtyChange?.(hasUserInput);
    },
    [hasUserInput, onInputDirtyChange]
  );

  const onSubmit = async (data: LoginFormInput) => {
    await login({ email: data.email, password: data.password });

    if (data.saveEmail) {
      LocalStorageUtil.setItem(SAVED_ID_KEY, data.email);
    } else {
      LocalStorageUtil.removeItem(SAVED_ID_KEY);
    }
  };

  return {
    form,
    onSubmit,
    isPending,
  };
}
