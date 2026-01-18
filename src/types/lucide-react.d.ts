/**
 * lucide-react 직접 import를 위한 타입 선언
 * 배럴 파일 대신 직접 import를 사용할 때 타입 에러를 방지합니다.
 */

declare module 'lucide-react/dist/esm/icons/*' {
  import { LucideIcon } from 'lucide-react';
  const Icon: LucideIcon;
  /* eslint-disable import/no-default-export */
  export default Icon;
}
