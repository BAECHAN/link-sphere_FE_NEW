// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(e2e-port.js와 함께 고친다)
export function isPortFree(port: number): Promise<boolean>;
export function pickFreePort(start: number, end: number): Promise<number>;
