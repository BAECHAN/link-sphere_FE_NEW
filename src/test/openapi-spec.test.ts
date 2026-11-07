import { describe, expect, it } from 'vitest';
import { specNumber, specPattern } from '@/test/openapi-spec';

// 헬퍼가 undefined로 넘어가면 계약 테스트가 원인을 잃는다. src/test는 커버리지·뮤테이션 보고에서 빠지므로 여기서 고정한다.
describe('openapi-spec 헬퍼', () => {
  it.each([
    ['키워드가 없으면', () => specNumber('signup', 'password', 'maxItems'), 'maxItems'],
    ['패턴이 없으면', () => specPattern('createComment', 'images'), 'pattern'],
    ['필드가 없으면', () => specNumber('signup', 'passwrd', 'minLength'), 'passwrd'],
    ['본문 없는 요청이면', () => specNumber('getAllPosts', 'page', 'minLength'), 'getAllPosts'],
  ])('%s throw한다', (_, read, message) => {
    expect(read).toThrow(message);
  });

  it('스펙에 없는 operationId는 타입과 실행 양쪽에서 막힌다', () => {
    // @ts-expect-error -- 스펙에 없는 operationId
    expect(() => specNumber('signupp', 'password', 'minLength')).toThrow('signupp');
  });
});
