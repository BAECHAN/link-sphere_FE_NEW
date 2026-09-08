import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from '@/widgets/post/post-list/utils/search-parser';

describe('parseSearchQuery', () => {
  it('빈 문자열은 빈 객체를 반환한다', () => {
    expect(parseSearchQuery('')).toEqual({});
  });

  it('@카테고리 태그만 추출한다', () => {
    expect(parseSearchQuery('@DevOps')).toEqual({ category: 'DevOps' });
  });

  it('#닉네임 태그만 추출한다', () => {
    expect(parseSearchQuery('#테스트')).toEqual({ nickname: '테스트' });
  });

  it('카테고리·닉네임·검색어가 섞인 입력을 분리한다', () => {
    expect(parseSearchQuery('@DevOps #테스트 리액트')).toEqual({
      category: 'DevOps',
      nickname: '테스트',
      search: '리액트',
    });
  });

  it('@카테고리가 여러 개면 콤마로 연결한다', () => {
    expect(parseSearchQuery('@DevOps @AI')).toEqual({ category: 'DevOps,AI' });
  });

  it('태그를 제거하고 남은 공백을 정규화한다', () => {
    expect(parseSearchQuery('@DevOps   리액트   후기')).toEqual({
      category: 'DevOps',
      search: '리액트 후기',
    });
  });

  it('태그만 있고 검색어가 없으면 search는 undefined다', () => {
    expect(parseSearchQuery('@DevOps #테스트')).toEqual({
      category: 'DevOps',
      nickname: '테스트',
    });
  });

  // 아래 4개는 현재 정규식(/@(\S+)/, /#(\S+)/)의 실제 동작을 고정해 회귀를 막는 케이스다.
  // 세 가지(이메일 파손·단어 중간 #·연속 @)는 사용자가 실제로 겪을 수 있는 문제라
  // 별도로 보고한다 — 이 테스트는 "지금 이렇게 동작한다"만 검증하고 동작을 바꾸지 않는다.
  it('이메일 주소의 @ 뒤가 category로 잘못 추출된다 (알려진 동작)', () => {
    expect(parseSearchQuery('contact me at hong@example.com')).toEqual({
      category: 'example.com',
      search: 'contact me at hong',
    });
  });

  it('단어 중간의 #도 태그로 추출된다 (알려진 동작)', () => {
    expect(parseSearchQuery('a#b')).toEqual({ nickname: 'b', search: 'a' });
  });

  it('@가 연속되면 하나만 벗겨진다 (알려진 동작)', () => {
    expect(parseSearchQuery('@@AI')).toEqual({ category: '@AI' });
  });

  it('@ 하나만 있으면 태그로 잡히지 않고 검색어로 남는다', () => {
    expect(parseSearchQuery('@')).toEqual({ search: '@' });
  });
});
