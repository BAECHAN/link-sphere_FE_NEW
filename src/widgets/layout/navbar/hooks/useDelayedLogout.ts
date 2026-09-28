import { useState } from 'react';
import { useAuth } from '@/entities/auth/hooks/useAuth';

/**
 * 로그아웃이 처리되고 있음을 잠깐 보여준 뒤 실제 로그아웃한다 (즉시 로그인 버튼으로
 * 바뀌어 정말 로그아웃됐는지 사용자가 의심하는 것을 방지).
 */
export function useDelayedLogout() {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    logout();
    setIsLoggingOut(false);
  };

  return { isLoggingOut, handleLogout };
}
