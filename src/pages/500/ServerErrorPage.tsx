import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

export function ServerErrorPage() {
  const navigate = useNavigate();

  return (
    <ErrorLayout
      title="500"
      description="서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
      onHomeClick={() => navigate(ROUTES_PATHS.HOME)}
    />
  );
}
