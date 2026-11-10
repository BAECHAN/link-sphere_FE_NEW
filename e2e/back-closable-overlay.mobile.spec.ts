import { describeBackClosableOverlays } from './back-closable-overlay.cases';

// 뒤로가기로 닫히는 오버레이 전부를 Pixel 5 에뮬레이션에서 실제 뒤로가기(page.goBack)로 본다. Android 뒤로 버튼
// 자체는 Playwright로 누를 수 없다 - 그 버튼이 히스토리 칸을 빼는지는 같은 방식으로 여는 왼쪽 메뉴가 실제 폰에서
// 닫히는 것으로 확인했다(docs/BACK-NAVIGATION.md). 사례와 검사는 back-closable-overlay.cases.ts
describeBackClosableOverlays();
