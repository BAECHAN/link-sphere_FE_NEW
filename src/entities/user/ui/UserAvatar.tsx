import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/atoms/avatar';
import { cn } from '@/shared/lib/tailwind/utils';
import { getTransformedImageUrl } from '@/shared/lib/image/supabaseImage';
import { useImageViewer } from '@/shared/ui/elements/modal/image-viewer/imageViewer.store';
import { TEXTS } from '@/shared/config/texts';

interface UserAvatarProps {
  image?: string | null;
  nickname?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** true면 클릭 시 원본 이미지를 전역 라이트박스로 확대해서 보여준다 */
  zoomable?: boolean;
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

export function UserAvatar({
  image,
  nickname,
  size = 'md',
  className,
  zoomable = false,
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const { openImageViewer } = useImageViewer();
  const nicknameInitial = nickname?.[0]?.toUpperCase();

  // 아바타 URL이 바뀌면(업로드 미리보기 전환 등) 이전 URL의 에러 상태를 들고 있지 않는다
  useEffect(() => {
    setHasError(false);
  }, [image]);

  const showFallback = (!image || hasError) && nicknameInitial;

  const avatar = (
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

  // 확대할 원본이 없으면(이미지 없음/로드 실패) 버튼으로 감싸지 않는다
  if (!zoomable || !image || hasError) {
    return avatar;
  }

  return (
    <button
      type="button"
      className="inline-flex shrink-0 cursor-pointer rounded-full"
      aria-label={TEXTS.ariaLabels.profileImageZoom}
      onClick={() => openImageViewer({ src: image, alt: nickname ?? '' })}
    >
      {avatar}
    </button>
  );
}
