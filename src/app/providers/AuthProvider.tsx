import { useAppInitialization } from '@/domains/auth/_common/hooks/useAppInitialization';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isInitialized } = useAppInitialization();

  if (!isInitialized) {
    // TODO: add global loading
    return <></>;
  }

  return <>{children}</>;
}
