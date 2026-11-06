import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { FeaturedIcon } from '@/shared/ui/atoms/featured-icon';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useConfirmEmailVerification } from '@/features/auth/email-verification/hooks/useConfirmEmailVerification';
import { useAuthStore } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';

export const VerifyEmailStatus = () => {
  const { status: confirmStatus } = useConfirmEmailVerification();
  // 로그인 여부는 계정 프로필(useAccount)이 아니라 로그인 플래그로 정한다 - 프로필은 로그인 뒤에 따로 받아 와
  // 조회 전·실패 때 비로그인으로 보인다. 이 화면은 인증 게이트 밖이라, 복원이 끝날 때까지는 확인 중으로 둔다
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  const status = isAuthResolved ? confirmStatus : 'pending';

  return (
    <div className="flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-muted-foreground/10 gap-4">
        <CardHeader className="text-center space-y-3">
          {status === 'pending' && (
            <Spinner className="mx-auto mb-1 size-11 text-muted-foreground" />
          )}
          {status === 'success' && (
            <FeaturedIcon icon={CheckCircle2} tone="success" className="mx-auto mb-1" />
          )}
          {(status === 'error' || status === 'unknown') && (
            <FeaturedIcon icon={XCircle} tone="destructive" className="mx-auto mb-1" />
          )}
          <CardTitle>
            {status === 'pending' && TEXTS.auth.verifyEmail.pendingTitle}
            {status === 'success' && TEXTS.auth.verifyEmail.successTitle}
            {status === 'error' && TEXTS.auth.verifyEmail.errorTitle}
            {status === 'unknown' && TEXTS.auth.verifyEmail.unknownTitle}
          </CardTitle>
          {status !== 'pending' && (
            <CardDescription>
              {status === 'success' && TEXTS.auth.verifyEmail.successDescription}
              {status === 'error' && TEXTS.auth.verifyEmail.errorDescription}
              {status === 'unknown' && TEXTS.auth.verifyEmail.unknownDescription}
            </CardDescription>
          )}
        </CardHeader>
        {status !== 'pending' && (
          <CardFooter>
            <Button asChild className="w-full h-11">
              {status === 'success' ? (
                <Link to={isAuthenticated ? ROUTES_PATHS.POST.ROOT : ROUTES_PATHS.AUTH.LOGIN}>
                  {isAuthenticated
                    ? TEXTS.auth.verifyEmail.goToFeed
                    : TEXTS.auth.verifyEmail.goToLogin}
                </Link>
              ) : (
                <Link to={isAuthenticated ? ROUTES_PATHS.MY_ACCOUNT : ROUTES_PATHS.AUTH.LOGIN}>
                  {isAuthenticated
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
