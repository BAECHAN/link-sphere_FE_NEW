/**
 * 로컬 dev 서버 포트의 단일 정의. vite.config.ts와 playwright.config.ts가 각자 리터럴
 * `31119`를 따로 들고 있으면 포트를 바꿀 때 한쪽만 고치고 다른 쪽을 놓치는 드리프트가
 * 생길 수 있어(2026-09-14 발견) 여기 하나로 모은다.
 */
export const DEV_SERVER_PORT = 31119;
