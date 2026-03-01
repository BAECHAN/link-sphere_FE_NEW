import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/atoms/avatar';
import { cn } from '@/shared/lib/tailwind/utils';

interface UserAvatarProps {
  image?: string | null;
  nickname?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
};

export function UserAvatar({ image, nickname, size = 'md', className }: UserAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={image || ''} />
      <AvatarFallback>{nickname?.[0] || '?'}</AvatarFallback>
    </Avatar>
  );
}
