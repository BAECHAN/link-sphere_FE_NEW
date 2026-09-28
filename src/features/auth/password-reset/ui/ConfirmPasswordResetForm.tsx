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
import { Link } from 'react-router-dom';
import { Lock, Clock } from 'lucide-react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { FormProvider } from 'react-hook-form';
import { useConfirmPasswordReset } from '@/features/auth/password-reset/hooks/useConfirmPasswordReset';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';
import { TEXTS } from '@/shared/config/texts';

export const ConfirmPasswordResetForm = () => {
  const { form, onSubmit, isPending, hasToken } = useConfirmPasswordReset();

  return (
    <div className="flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-muted-foreground/10 gap-4">
        <CardHeader className="text-center space-y-3">
          <IconBadge
            icon={hasToken ? Lock : Clock}
            tone={hasToken ? 'info' : 'warning'}
            className="mx-auto mb-1"
          />
          <CardTitle>
            {hasToken ? TEXTS.auth.resetPassword.title : TEXTS.auth.resetPassword.invalidTokenTitle}
          </CardTitle>
          <CardDescription>
            {hasToken ? (
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
        {hasToken && (
          <CardContent>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormInputPassword
                  name="newPassword"
                  label={TEXTS.labels.newPassword}
                  required
                  disabled={isPending}
                  placeholder={TEXTS.placeholders.password}
                  description={TEXTS.descriptions.passwordGuide}
                />
                <FormInputPassword
                  name="confirmPassword"
                  label={TEXTS.labels.confirmPassword}
                  required
                  disabled={isPending}
                  placeholder={TEXTS.placeholders.confirmPassword}
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
          {!hasToken && (
            <Button asChild className="w-full h-11 mt-1">
              <Link to={ROUTES_PATHS.AUTH.FORGOT_PASSWORD}>
                {TEXTS.auth.resetPassword.requestNewLink}
              </Link>
            </Button>
          )}
          <div className="border-t pt-3 text-sm text-center text-muted-foreground">
            <Link to={ROUTES_PATHS.AUTH.LOGIN} className="text-primary hover:underline font-medium">
              {TEXTS.auth.resetPassword.backToLogin}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
