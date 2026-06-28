import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export function ServerErrorPage() {
  const navigate = useNavigate();

  return (
    <ErrorLayout
      title="500"
      description={TEXTS.errors.serverError.description}
      onHomeClick={() => navigate(ROUTES_PATHS.HOME)}
    />
  );
}
