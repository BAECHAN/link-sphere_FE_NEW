import { Link } from 'react-router-dom';
import { LoginForm } from '@/features/auth/login/ui/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export const LoginPage = () => {
  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link
            to={ROUTES_PATHS.POST.ROOT}
            className="mb-1 font-bold text-3xl tracking-tight hover:opacity-80 transition-opacity"
          >
            {TEXTS.nav.brand}
          </Link>
          <CardTitle>{TEXTS.auth.login.title}</CardTitle>
          <CardDescription>{TEXTS.auth.login.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
};
