import { useLocation } from 'react-router-dom';
import { GlobalAlertDialogs } from '@/shared/ui/elements/dialog/alert-dialog/GlobalAlertDialogs';

/**
 * 이 앱의 확인창 장착부 - 범용 `GlobalAlertDialogs`에 라우터 위치를 이어 준다(앱 전용).
 * 열려 있던 위치를 벗어나면(뒤로가기 등) 확인창이 취소로 닫힌다. pathname이 아니라 key를 넘기는
 * 이유는 GlobalAlertDialogs.tsx의 주석을 본다.
 *
 * app 레이어가 아니라 여기 둔 이유: 확인창을 앱처럼 그려야 하는 테스트가 shared·features에도 있어
 * app 레이어 파일을 import할 수 없다(docs/DESIGN-SYSTEM-PRINCIPLES.md §5).
 */
export function RouteAlertDialogs() {
  const location = useLocation();

  return <GlobalAlertDialogs dismissKey={location.key} />;
}
