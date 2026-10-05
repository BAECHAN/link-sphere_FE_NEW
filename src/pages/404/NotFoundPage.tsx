import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { useNoIndex } from '@/shared/hooks/useNoIndex';

export function NotFoundPage() {
  useNoIndex();

  return (
    <ErrorLayout
      title={TEXTS.errors.notFound.title}
      description={TEXTS.errors.notFound.description}
      homeTo={ROUTES_PATHS.HOME}
    />
  );
}
