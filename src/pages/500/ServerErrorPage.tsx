import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export function ServerErrorPage() {
  return (
    <ErrorLayout
      title="500"
      description={TEXTS.errors.serverError.description}
      homeTo={ROUTES_PATHS.HOME}
    />
  );
}
