import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/atoms/button';
import { FormProvider } from 'react-hook-form';
import { useLogin } from '@/features/auth/login/hooks/useLogin';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';
import { FormCheckbox } from '@/shared/ui/elements/form/FormCheckbox';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

/**
 * 로그인 폼 본문 (페이지·모달 공용).
 * 페이지 chrome(Card/센터링)은 LoginPage가, 모달 chrome은 LoginModal이 담당한다.
 */
export const LoginForm = () => {
  const { form, onSubmit, isPending } = useLogin();

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormInput
          name="email"
          label="Email"
          type="email"
          placeholder="test@example.com"
          required
          disabled={isPending}
        />
        <FormInputPassword name="password" label="Password" required disabled={isPending} />
        <FormCheckbox name="saveEmail" label={TEXTS.ariaLabels.saveEmail} disabled={isPending} />
        <Button type="submit" className="w-full h-11" disabled={isPending}>
          {isPending ? TEXTS.auth.login.signingIn : TEXTS.auth.login.signIn}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm text-muted-foreground">
        {`${TEXTS.auth.login.noAccount} `}
        <Link to={ROUTES_PATHS.AUTH.SIGNUP} className="text-primary hover:underline font-medium">
          {TEXTS.auth.login.signUp}
        </Link>
      </div>
    </FormProvider>
  );
};
