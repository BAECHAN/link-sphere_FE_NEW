import { Link } from 'react-router-dom';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { Button } from '@/shared/ui/atoms/button';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { useNoIndex } from '@/shared/hooks/useNoIndex';

export function NotFoundPage() {
  useNoIndex();

  return (
    <ErrorLayout
      title={TEXTS.errors.notFound.title}
      description={TEXTS.errors.notFound.description}
      homeAction={
        <Button asChild>
          <Link to={ROUTES_PATHS.HOME}>{TEXTS.buttons.home}</Link>
        </Button>
      }
    />
  );
}
