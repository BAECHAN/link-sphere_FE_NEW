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
import { LabeledDivider } from '@/shared/ui/atoms/labeled-divider';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle2 } from 'lucide-react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { FormProvider } from 'react-hook-form';
import { useRequestPasswordReset } from '@/features/auth/password-reset/hooks/useRequestPasswordReset';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { TEXTS } from '@/shared/config/texts';

export const RequestPasswordResetForm = () => {
  const { form, onSubmit, isPending, isSubmitted, handleResend } = useRequestPasswordReset();

  return (
    <div className="flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-muted-foreground/10 gap-4">
        <CardHeader className="text-center space-y-3">
          <IconBadge
            icon={isSubmitted ? CheckCircle2 : Mail}
            tone={isSubmitted ? 'success' : 'info'}
            className="mx-auto mb-1"
          />
          <CardTitle>
            {isSubmitted
              ? TEXTS.auth.forgotPassword.checkEmailTitle
              : TEXTS.auth.forgotPassword.title}
          </CardTitle>
          <CardDescription>
            {isSubmitted ? (
              <>
                {TEXTS.auth.forgotPassword.checkEmailDescription1}{' '}
                {/* 좁은 화면(640px 미만)에서는 "비밀번호 재설정" 뒤 강제 개행까지 넣으면
                    3줄이 된다(1번째 줄이 그 자체로 이미 폭을 다 채워서) - sm 이상에서만
                    block로 전환해 강제 개행하고, 그 아래에서는 자연 줄바꿈에 맡겨 2줄을
                    유지한다. */}
                <span className="sm:block">{TEXTS.auth.forgotPassword.checkEmailDescription2}</span>
              </>
            ) : (
              TEXTS.auth.forgotPassword.subtitle
            )}
          </CardDescription>
        </CardHeader>
        {!isSubmitted && (
          <CardContent>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormInput
                  name="email"
                  label={TEXTS.labels.email}
                  type="email"
                  placeholder={TEXTS.placeholders.email}
                  required
                  disabled={isPending}
                />
                <Button type="submit" className="w-full h-11" disabled={isPending}>
                  {isPending
                    ? TEXTS.auth.forgotPassword.submitting
                    : TEXTS.auth.forgotPassword.submit}
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        )}
        {isSubmitted && (
          <CardContent className="space-y-4">
            <LabeledDivider>{TEXTS.auth.forgotPassword.resendPrompt}</LabeledDivider>
            <Button
              variant="outline"
              className="w-full h-11"
              disabled={isPending}
              onClick={handleResend}
            >
              {isPending ? TEXTS.auth.forgotPassword.submitting : TEXTS.auth.forgotPassword.resend}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {TEXTS.auth.forgotPassword.checkSpamHint}
            </p>
          </CardContent>
        )}
        <CardFooter className="flex flex-col items-stretch space-y-4">
          <div className="border-t pt-3 text-sm text-center text-muted-foreground">
            <Link to={ROUTES_PATHS.AUTH.LOGIN} className="text-primary hover:underline font-medium">
              {TEXTS.auth.forgotPassword.backToLogin}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
