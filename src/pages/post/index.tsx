import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/atoms/button';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

export function Post() {
  return (
    <div className="w-full space-y-6 md:space-y-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold">Recent Links</h1>
        <Link to={ROUTES_PATHS.POST.SUBMIT}>
          <Button size="sm" className="md:h-10">
            Submit Link
          </Button>
        </Link>
      </div>
    </div>
  );
}
