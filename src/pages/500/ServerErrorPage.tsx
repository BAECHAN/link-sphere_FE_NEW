import { Link } from 'react-router-dom';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { Button } from '@link-sphere/ui/atoms/button';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export function ServerErrorPage() {
  return (
    <ErrorLayout
      title="500"
      description={TEXTS.errors.serverError.description}
      homeAction={
        <Button asChild>
          <Link to={ROUTES_PATHS.HOME}>{TEXTS.buttons.home}</Link>
        </Button>
      }
    />
  );
}
