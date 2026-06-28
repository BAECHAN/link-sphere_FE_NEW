import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <ErrorLayout
      title={TEXTS.errors.forbidden.title}
      description={TEXTS.errors.forbidden.description}
      onHomeClick={() => {
        navigate(ROUTES_PATHS.HOME);
      }}
    />
  );
}
