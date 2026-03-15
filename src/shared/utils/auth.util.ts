import { useAuthStore } from '@/shared/store/auth.store';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { NavigationService } from '@/shared/lib/router/navigation';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

export class AuthUtil {
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
