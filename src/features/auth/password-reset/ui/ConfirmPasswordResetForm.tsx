import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/ui/atoms/card';
import { Button } from '@baechan/ui/atoms/button';
import { FeaturedIcon } from '@/shared/ui/atoms/featured-icon';
import { Link } from 'react-router-dom';
import { Lock, Clock } from 'lucide-react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { FormProvider } from 'react-hook-form';
import { useConfirmPasswordReset } from '@/features/auth/password-reset/hooks/useConfirmPasswordReset';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';
import { PasswordRequirementList } from '@/entities/auth/ui/PasswordRequirementList';
import { PasswordConfirmMessage } from '@/entities/auth/ui/PasswordConfirmMessage';
import { TEXTS } from '@/shared/config/texts';

export const ConfirmPasswordResetForm = () => {
  const { form, onSubmit, isPending, hasToken, isTokenRejected, passwordFeedback } =
    useConfirmPasswordReset();
  // 거절된 링크(만료·이미 사용)도 링크가 없을 때와 같은 카드로 새 링크를 요청하게 한다
  const isFormShown = hasToken && !isTokenRejected;

  return (
    <div className="flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
      <Card
        // eslint-disable-next-line custom-tailwind/semantic-color-kind -- 인증 카드 테두리는 보조 글자색을 옅게 깔아 쓴다(선 색이 아니라 값을 지키려고 글자 색을 둔다)
        className="w-full max-w-md shadow-s4 border-fg-neutral-muted/10 gap-4"
      >
        <CardHeader className="text-center space-y-3">
          <FeaturedIcon
            icon={isFormShown ? Lock : Clock}
            variant={isFormShown ? 'info' : 'warning'}
            className="mx-auto mb-1"
          />
          <CardTitle>
            {isFormShown
              ? TEXTS.auth.resetPassword.title
              : TEXTS.auth.resetPassword.invalidTokenTitle}
          </CardTitle>
          <CardDescription>
            {isFormShown ? (
              TEXTS.auth.resetPassword.subtitle
            ) : (
              <>
                {TEXTS.auth.resetPassword.invalidTokenDescription}{' '}
                <span className="whitespace-nowrap">
                  {TEXTS.auth.resetPassword.invalidTokenRetryPrompt}
                </span>
              </>
            )}
          </CardDescription>
        </CardHeader>
        {isFormShown && (
          <CardContent>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormInputPassword
                  name="newPassword"
                  label={TEXTS.labels.newPassword}
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
                <Button type="submit" className="w-full h-11" disabled={isPending}>
                  {isPending
                    ? TEXTS.auth.resetPassword.submitting
                    : TEXTS.auth.resetPassword.submit}
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        )}
        <CardFooter className="flex flex-col items-stretch space-y-4">
          {!isFormShown && (
            <Button asChild className="w-full h-11 mt-1">
              <Link to={ROUTES_PATHS.AUTH.FORGOT_PASSWORD}>
                {TEXTS.auth.resetPassword.requestNewLink}
              </Link>
            </Button>
          )}
          <div className="border-t pt-3 text-sm text-center text-fg-neutral-muted">
            <Link
              to={ROUTES_PATHS.AUTH.LOGIN}
              className="text-fg-brand hover:underline font-medium"
            >
              {TEXTS.auth.resetPassword.backToLogin}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
