import { useAuthStore } from '@/shared/store/auth.store';
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
