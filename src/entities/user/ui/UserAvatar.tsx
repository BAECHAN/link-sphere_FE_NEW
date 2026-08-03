import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/atoms/avatar';
import { cn } from '@/shared/lib/tailwind/utils';
import { getTransformedImageUrl } from '@/shared/lib/image/supabaseImage';

interface UserAvatarProps {
  image?: string | null;
  nickname?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-20 w-20',
};

// 실제 렌더 크기의 2배(고밀도 디스플레이 대응)로 변환 요청한다
const transformSizes = {
  sm: 48,
  md: 64,
  lg: 160,
};

export function UserAvatar({ image, nickname, size = 'md', className }: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const nicknameInitial = nickname?.[0]?.toUpperCase();

  // 아바타 URL이 바뀌면(업로드 미리보기 전환 등) 이전 URL의 에러 상태를 들고 있지 않는다
  useEffect(() => {
    setHasError(false);
  }, [image]);

  const showFallback = (!image || hasError) && nicknameInitial;

  return (
    <Avatar className={cn('bg-muted', sizeClasses[size], className)}>
      {image && !hasError && (
        <AvatarImage
          src={getTransformedImageUrl(image, { width: transformSizes[size] })}
          alt={nickname ?? ''}
          onLoadingStatusChange={(status) => {
            if (status === 'error') {
              setHasError(true);
            }
          }}
        />
      )}
      {showFallback && <AvatarFallback>{nicknameInitial}</AvatarFallback>}
    </Avatar>
  );
}
