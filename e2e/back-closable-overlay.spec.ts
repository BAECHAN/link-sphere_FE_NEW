import { describeBackClosableOverlays } from './back-closable-overlay.cases';

// 뒤로가기로 닫히는 오버레이 전부를 데스크톱에서 실제 뒤로가기(page.goBack)로 본다. 사례와 검사는
// back-closable-overlay.cases.ts, 같은 검사의 Pixel 5 쪽은 back-closable-overlay.mobile.spec.ts
describeBackClosableOverlays();
