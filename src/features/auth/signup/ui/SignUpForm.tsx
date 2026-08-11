import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { Link } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { FormProvider } from 'react-hook-form';
import { useSignUp } from '@/features/auth/signup/hooks/useSignUp';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';
import { TEXTS } from '@/shared/config/texts';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';

export const SignUpForm = () => {
  const { form, onSubmit, isPending, emailCheck, nicknameCheck, isSubmitDisabled } = useSignUp();

  // 체크가 빨리 끝나면(대부분의 경우) "확인 중이에요..."가 깜빡이지 않도록 300ms 지연 후에만
  // 보여준다 (useUpdateProfile.ts와 동일한 패턴)
  const showEmailChecking = useDelayedLoading(emailCheck.isChecking, 300);
  const showNicknameChecking = useDelayedLoading(nicknameCheck.isChecking, 300);

  // 중복(destructive 빨강)은 useSignUp.ts가 RHF 필드 에러로 이미 반영해뒀으므로 FormField가
  // 자동으로 그 메시지를 우선 표시한다 - 여기서는 확인 중·사용 가능 상태만 안내하면 된다.
  const emailDescription = showEmailChecking
    ? TEXTS.auth.signup.checking
    : emailCheck.isAvailable
      ? TEXTS.auth.signup.emailAvailable
      : undefined;
  const nicknameDescription = showNicknameChecking
    ? TEXTS.auth.signup.checking
    : nicknameCheck.isAvailable
      ? TEXTS.auth.signup.nicknameAvailable
      : undefined;

  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-muted-foreground/10">
        <CardHeader className="text-center space-y-1">
          <Link
            to={ROUTES_PATHS.POST.ROOT}
            className="font-bold text-3xl tracking-tight hover:opacity-80 transition-opacity"
          >
            {TEXTS.nav.brand}
          </Link>
          <CardTitle>{TEXTS.auth.signup.title}</CardTitle>
          <CardDescription>{TEXTS.auth.signup.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormInput
                name="nickname"
                label="Nickname"
                type="text"
                placeholder={TEXTS.placeholders.nickname}
                required
                disabled={isPending}
                description={nicknameDescription}
                descriptionVariant={nicknameCheck.isAvailable ? 'success' : 'default'}
              />
              <div className="space-y-1">
                <FormInput
                  name="email"
                  label="Email"
                  type="email"
                  placeholder={TEXTS.placeholders.email}
                  required
                  disabled={isPending}
                  description={emailDescription}
                  descriptionVariant={emailCheck.isAvailable ? 'success' : 'default'}
                />
                {emailCheck.isDuplicate && (
                  <div className="text-right">
                    <Link
                      to={ROUTES_PATHS.AUTH.LOGIN}
                      className="text-sm text-primary hover:underline"
                    >
                      {TEXTS.auth.signup.signIn}
                    </Link>
                  </div>
                )}
              </div>
              <FormInputPassword
                name="password"
                label="Password"
                required
                disabled={isPending}
                placeholder={TEXTS.placeholders.password}
                description={TEXTS.descriptions.passwordGuide}
              />
              <Button className="w-full h-11" disabled={isSubmitDisabled}>
                {isPending ? TEXTS.auth.signup.signingUp : TEXTS.auth.signup.signUp}
              </Button>
            </form>
          </FormProvider>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            {TEXTS.auth.signup.alreadyAccount}{' '}
            <Link to={ROUTES_PATHS.AUTH.LOGIN} className="text-primary hover:underline font-medium">
              {TEXTS.auth.signup.signIn}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
