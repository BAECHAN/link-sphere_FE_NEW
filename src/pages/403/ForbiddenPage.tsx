import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <ErrorLayout
      title="접근 권한이 없습니다"
      description="요청하신 페이지에 접근할 수 없습니다."
      onHomeClick={() => {
        navigate(ROUTES_PATHS.HOME);
      }}
    />
  );
}
