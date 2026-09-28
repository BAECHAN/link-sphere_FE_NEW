import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { IconBadge } from '@/shared/ui/atoms/icon-badge';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useConfirmEmailVerification } from '@/features/auth/email-verification/hooks/useConfirmEmailVerification';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { TEXTS } from '@/shared/config/texts';

export const VerifyEmailStatus = () => {
  const { status } = useConfirmEmailVerification();
  const { isLoggedIn } = useAccount();

  return (
    <div className="flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-muted-foreground/10 gap-4">
        <CardHeader className="text-center space-y-3">
          {status === 'pending' && (
            <Spinner className="mx-auto mb-1 size-11 text-muted-foreground" />
          )}
          {status === 'success' && (
            <IconBadge icon={CheckCircle2} tone="success" className="mx-auto mb-1" />
          )}
          {status === 'error' && (
            <IconBadge icon={XCircle} tone="destructive" className="mx-auto mb-1" />
          )}
          <CardTitle>
            {status === 'pending' && TEXTS.auth.verifyEmail.pendingTitle}
            {status === 'success' && TEXTS.auth.verifyEmail.successTitle}
            {status === 'error' && TEXTS.auth.verifyEmail.errorTitle}
          </CardTitle>
          {status !== 'pending' && (
            <CardDescription>
              {status === 'success'
                ? TEXTS.auth.verifyEmail.successDescription
                : TEXTS.auth.verifyEmail.errorDescription}
            </CardDescription>
          )}
        </CardHeader>
        {status !== 'pending' && (
          <CardFooter>
            <Button asChild className="w-full h-11">
              {status === 'success' ? (
                <Link to={isLoggedIn ? ROUTES_PATHS.POST.ROOT : ROUTES_PATHS.AUTH.LOGIN}>
                  {isLoggedIn ? TEXTS.auth.verifyEmail.goToFeed : TEXTS.auth.verifyEmail.goToLogin}
                </Link>
              ) : (
                <Link to={isLoggedIn ? ROUTES_PATHS.MY_ACCOUNT : ROUTES_PATHS.AUTH.LOGIN}>
                  {isLoggedIn
                    ? TEXTS.auth.verifyEmail.goToAccountSettings
                    : TEXTS.auth.verifyEmail.goToLogin}
                </Link>
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};
