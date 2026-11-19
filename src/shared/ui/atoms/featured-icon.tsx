import { cva, type VariantProps } from 'class-variance-authority';
import { type LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/tailwind/utils';

const featuredIconVariants = cva(
  'h-11 w-11 rounded-full flex items-center justify-center shrink-0 [&>svg]:size-5',
  {
    variants: {
      variant: {
        info: 'bg-info/10 text-info',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/15 text-warning',
        destructive: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

export interface FeaturedIconProps extends VariantProps<typeof featuredIconVariants> {
  icon: LucideIcon;
  className?: string;
}

function FeaturedIcon({ icon: Icon, variant, className }: FeaturedIconProps) {
  return (
    <div className={cn(featuredIconVariants({ variant }), className)}>
      <Icon />
    </div>
  );
}

export { FeaturedIcon, featuredIconVariants };
