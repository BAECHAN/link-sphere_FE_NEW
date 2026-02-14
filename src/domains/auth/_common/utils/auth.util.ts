import { useAuthStore } from '@/domains/auth/_common/model/auth.store';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';

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
  }
}
