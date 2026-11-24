import { Link } from 'react-router-dom';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { Button } from '@baechan/ui/atoms/button';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export function ForbiddenPage() {
  return (
    <ErrorLayout
      title={TEXTS.errors.forbidden.title}
      description={TEXTS.errors.forbidden.description}
      homeAction={
        <Button asChild>
          <Link to={ROUTES_PATHS.HOME}>{TEXTS.buttons.home}</Link>
        </Button>
      }
    />
  );
}
