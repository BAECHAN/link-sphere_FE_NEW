import { useAppInitialization } from '@/entities/user/hooks/useAppInitialization';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isInitialized } = useAppInitialization();

  if (!isInitialized) {
    return <SpinnerOverlay delay={0} className="h-screen" />;
  }

  return <>{children}</>;
}
