import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export function ForbiddenPage() {
  return (
    <ErrorLayout
      title={TEXTS.errors.forbidden.title}
      description={TEXTS.errors.forbidden.description}
      homeTo={ROUTES_PATHS.HOME}
    />
  );
}
