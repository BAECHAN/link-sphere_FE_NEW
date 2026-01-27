import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/atoms/button';
import { Label } from '@/shared/ui/atoms/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { FormProvider } from 'react-hook-form';
import { useLogin } from '@/domains/auth/features/login/hooks/useLogin';
import { FormInput } from '@/shared/ui/elements/FormInput';
import { FormInputPassword } from '@/shared/ui/elements/FormInputPassword';

export const LoginForm = () => {
  const { form, onSubmit, isPending } = useLogin();

  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome to LinkSphere</CardTitle>
          <CardDescription>Sign in to share and discover links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <FormInput
                  name="email"
                  type="email"
                  placeholder="test@example.com"
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <FormInputPassword name="password" required disabled={isPending} />
              </div>
              <Button type="submit" className="w-full h-11" disabled={isPending}>
                {isPending ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </FormProvider>
        </CardContent>
        <div className="px-6 pb-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Register
          </Link>
        </div>
      </Card>
    </div>
  );
};
