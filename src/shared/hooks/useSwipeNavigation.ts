import type { PanInfo } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@/shared/config/nav-items';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

const DISTANCE_THRESHOLD = 80;
// 글쓰기 폼 화면은 입력 간섭을 줄이기 위해 큰 임계값 사용
const FORM_DISTANCE_THRESHOLD = 160;
const VELOCITY_THRESHOLD = 500;

/**
 * 모바일에서 좌우 드래그로 인접 메뉴(NAV_ITEMS)로 전환하는 훅
 * @returns enabled - 현재 화면에서 스와이프 활성 여부, onDragEnd - motion.div의 드래그 종료 핸들러
 */
export function useSwipeNavigation() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // isActive(startsWith)가 아닌 정확 매칭 → 상세/편집 페이지 자연 제외
  const currentIndex = NAV_ITEMS.findIndex((item) => item.to === pathname);
  const enabled = isMobile && currentIndex !== -1;

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (currentIndex === -1) return;

    const distanceThreshold =
      pathname === ROUTES_PATHS.POST.SUBMIT ? FORM_DISTANCE_THRESHOLD : DISTANCE_THRESHOLD;

    const passedThreshold =
      Math.abs(info.offset.x) > distanceThreshold || Math.abs(info.velocity.x) > VELOCITY_THRESHOLD;

    if (!passedThreshold) return;

    // 왼쪽 드래그(offset.x < 0) → 다음, 오른쪽 드래그 → 이전
    const targetIndex = info.offset.x < 0 ? currentIndex + 1 : currentIndex - 1;
    const target = NAV_ITEMS[targetIndex];

    if (!target) return;

    navigate(target.to);
  };

  return { enabled, onDragEnd };
}
