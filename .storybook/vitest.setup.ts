import { setProjectAnnotations } from '@storybook/react-vite';
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

import * as previewAnnotations from './preview';

// addon-vitest가 이 setup 파일을 불러와 각 스토리를 실제 컴포넌트 테스트로 구성한다.
// a11y addon의 annotations를 먼저 등록해야 각 스토리 테스트 실행 시 axe-core 검사가
// 함께 돈다 - preview.tsx의 데코레이터(다크모드 토글)는 그 뒤에 이어붙여 순서를 지킨다.
setProjectAnnotations([a11yAddonAnnotations, previewAnnotations]);
