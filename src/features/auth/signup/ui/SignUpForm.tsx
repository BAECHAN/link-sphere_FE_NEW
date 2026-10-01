import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { IconBadge } from '@/shared/ui/atoms/icon-badge';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { FormProvider } from 'react-hook-form';
import { useSignUp } from '@/features/auth/signup/hooks/useSignUp';
import { useAvailabilityMessage } from '@/shared/hooks/useAvailabilityMessage';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';
import { PasswordRequirementList } from '@/entities/auth/ui/PasswordRequirementList';
import { PasswordConfirmMessage } from '@/entities/auth/ui/PasswordConfirmMessage';
import { TEXTS } from '@/shared/config/texts';

export const SignUpForm = () => {
  const {
    form,
    onSubmit,
    isPending,
    isSubmitted,
    emailCheck,
    nicknameCheck,
    passwordFeedback,
    isSubmitDisabled,
    onLoginLinkClick,
    loginLinkState,
    postSignupLoginState,
  } = useSignUp();

  const emailMessage = useAvailabilityMessage({
    isChecking: emailCheck.isChecking,
    isAvailable: emailCheck.isAvailable,
    checkingText: TEXTS.auth.signup.checking,
    availableText: TEXTS.auth.signup.emailAvailable,
    hintText: TEXTS.auth.signup.emailHint,
  });
  const nicknameMessage = useAvailabilityMessage({
    isChecking: nicknameCheck.isChecking,
    isAvailable: nicknameCheck.isAvailable,
    checkingText: TEXTS.auth.signup.checking,
    availableText: TEXTS.auth.signup.nicknameAvailable,
    hintText: TEXTS.auth.signup.nicknameHint,
  });

  return (
    <div className="flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-muted-foreground/10 gap-4">
        <CardHeader className="text-center space-y-3">
          {isSubmitted ? (
            <>
              <IconBadge icon={CheckCircle2} tone="success" className="mx-auto mb-1" />
              <CardTitle>{TEXTS.auth.signup.checkEmailTitle}</CardTitle>
              <CardDescription>{TEXTS.auth.signup.checkEmailDescription}</CardDescription>
            </>
          ) : (
            <>
              <Link
                to={ROUTES_PATHS.POST.ROOT}
                // eslint-disable-next-line custom-tailwind/no-raw-title -- 브랜드 워드마크, 제목 역할 토큰 대상 아님
                className="font-bold text-3xl tracking-tight hover:opacity-80 transition-opacity"
              >
                {TEXTS.nav.brand}
              </Link>
              <CardTitle>{TEXTS.auth.signup.title}</CardTitle>
              <CardDescription>{TEXTS.auth.signup.subtitle}</CardDescription>
            </>
          )}
        </CardHeader>
        {!isSubmitted && (
          <CardContent>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormInput
                  name="nickname"
                  label={TEXTS.labels.nickname}
                  type="text"
                  placeholder={TEXTS.placeholders.nickname}
                  required
                  disabled={isPending}
                  description={nicknameMessage.description}
                  descriptionVariant={nicknameMessage.descriptionVariant}
                />
                <FormInput
                  name="email"
                  label={TEXTS.labels.email}
                  type="email"
                  placeholder={TEXTS.placeholders.email}
                  required
                  disabled={isPending}
                  description={emailMessage.description}
                  descriptionVariant={emailMessage.descriptionVariant}
                />
                <FormInputPassword
                  name="password"
                  label={TEXTS.labels.password}
                  required
                  disabled={isPending}
                  placeholder={TEXTS.placeholders.password}
                  {...passwordFeedback.passwordInputProps}
                  belowInput={
                    <PasswordRequirementList {...passwordFeedback.requirementListProps} />
                  }
                />
                <FormInputPassword
                  name="confirmPassword"
                  label={TEXTS.labels.confirmPassword}
                  required
                  disabled={isPending}
                  placeholder={TEXTS.placeholders.confirmPassword}
                  {...passwordFeedback.confirmInputProps}
                  belowInput={<PasswordConfirmMessage {...passwordFeedback.confirmMessageProps} />}
                />
                <Button className="w-full h-11" disabled={isSubmitDisabled}>
                  {isPending ? TEXTS.auth.signup.signingUp : TEXTS.auth.signup.signUp}
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        )}
        <CardFooter className="flex flex-col items-stretch space-y-4">
          {isSubmitted ? (
            <Button asChild className="w-full h-11">
              <Link to={ROUTES_PATHS.AUTH.LOGIN} state={postSignupLoginState}>
                {TEXTS.auth.signup.goToLogin}
              </Link>
            </Button>
          ) : (
            <div className="text-sm text-center text-muted-foreground">
              {TEXTS.auth.signup.alreadyAccount}{' '}
              <Link
                to={ROUTES_PATHS.AUTH.LOGIN}
                state={loginLinkState}
                onClick={onLoginLinkClick}
                className="text-primary hover:underline font-medium"
              >
                {TEXTS.auth.signup.signIn}
              </Link>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};
