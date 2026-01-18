import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ErrorLayout
      title="페이지를 찾을 수 없습니다"
      description="요청하신 페이지가 존재하지 않거나 삭제되었습니다."
      onHomeClick={() => {
        navigate(ROUTES_PATHS.HOME);
      }}
    />
  );
}
