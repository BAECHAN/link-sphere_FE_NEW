import { describe, expect, it } from 'vitest';
import { extractSearchTags, parseSearchQuery } from '@/widgets/post/post-list/utils/search-parser';

describe('extractSearchTags', () => {
  it('등장 순서를 유지하며 태그를 추출한다', () => {
    expect(extractSearchTags('리액트 @DevOps@AI #철수 후기')).toEqual(['@DevOps', '@AI', '#철수']);
  });

  it('태그가 없으면 빈 배열을 반환한다', () => {
    expect(extractSearchTags('그냥 검색어')).toEqual([]);
  });
});

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

  // 태그는 문자열 시작이나 공백 뒤에서만 시작하고, 다음 공백 또는 다음 @/#에서 끝난다
  // (search-parser.ts의 TAG_RUN/TAG_TOKEN 참고). 아래는 그 경계 규칙을 검증하는 케이스다.
  it('붙여 쓴 카테고리 태그를 각각으로 분리한다', () => {
    expect(parseSearchQuery('@라이프스타일@데이터')).toEqual({ category: '라이프스타일,데이터' });
  });

  it('붙여 쓴 카테고리+닉네임 태그를 각각으로 분리한다', () => {
    expect(parseSearchQuery('@라이프스타일#철수')).toEqual({
      category: '라이프스타일',
      nickname: '철수',
    });
  });

  it('자유 검색어 사이에 붙여 쓴 태그가 섞여도 올바르게 분리한다', () => {
    expect(parseSearchQuery('리액트 @DevOps@AI 후기')).toEqual({
      category: 'DevOps,AI',
      search: '리액트 후기',
    });
  });

  it('공백 없이 @ 뒤에 이어지는 이메일 주소는 태그로 추출하지 않는다', () => {
    expect(parseSearchQuery('contact me at hong@example.com')).toEqual({
      search: 'contact me at hong@example.com',
    });
  });

  it('단어 중간의 #은 태그로 추출하지 않는다', () => {
    expect(parseSearchQuery('a#b')).toEqual({ search: 'a#b' });
  });

  it('@가 연속되면 태그로 추출하지 않는다', () => {
    expect(parseSearchQuery('@@AI')).toEqual({ search: '@@AI' });
  });

  it('@ 하나만 있으면 태그로 잡히지 않고 검색어로 남는다', () => {
    expect(parseSearchQuery('@')).toEqual({ search: '@' });
  });
});
