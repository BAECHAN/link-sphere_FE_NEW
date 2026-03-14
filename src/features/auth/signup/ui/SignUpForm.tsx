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

export const SignUpForm = () => {
  const { form, onSubmit, isPending } = useSignUp();

  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-muted-foreground/10">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold">{TEXTS.auth.signup.title}</CardTitle>
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
              />
              <FormInput
                name="email"
                label="Email"
                type="email"
                placeholder={TEXTS.placeholders.email}
                required
                disabled={isPending}
              />
              <FormInputPassword
                name="password"
                label="Password"
                required
                disabled={isPending}
                placeholder={TEXTS.placeholders.password}
                description={TEXTS.descriptions.passwordGuide}
              />
              <Button className="w-full h-11" disabled={isPending}>
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
