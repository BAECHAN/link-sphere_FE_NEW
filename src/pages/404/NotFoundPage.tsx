import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ErrorLayout
      title={TEXTS.errors.notFound.title}
      description={TEXTS.errors.notFound.description}
      onHomeClick={() => {
        navigate(ROUTES_PATHS.HOME);
      }}
    />
  );
}
