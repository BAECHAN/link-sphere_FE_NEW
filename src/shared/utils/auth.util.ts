import { useAuthStore } from '@/shared/store/auth.store';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { NavigationService } from '@/shared/lib/router/navigation';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

export class AuthUtil {
  static isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return true;
      const payload = JSON.parse(atob(parts[1]!)) as { exp?: number };
      if (typeof payload.exp !== 'number') return true;
      return Date.now() / 1000 > payload.exp - 30;
    } catch {
      return true;
    }
  }

  static clearAuth(): void {
    useAuthStore.getState().clearAuth();
  }

  static clearQueries(): void {
    queryClient.cancelQueries();
    queryClient.clear();
  }

  static clearAll(): void {
    this.clearAuth();
    this.clearQueries();
    NavigationService.navigate(ROUTES_PATHS.AUTH.LOGIN, { replace: true });
  }
}
