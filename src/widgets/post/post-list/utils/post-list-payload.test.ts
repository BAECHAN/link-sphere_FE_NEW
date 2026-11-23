import { describe, expect, it } from 'vitest';
import { hasLoginOnlyFilter } from '@/widgets/post/post-list/utils/post-list-payload';

// 주소의 filter에 로그인 전용 값이 있으면 로그아웃 상태에서는 목록·미리 받기 요청을 보내지 않는다.
// BE가 쉼표로 나눈 값의 앞뒤 공백을 떼고 보므로, 손으로 친 주소도 같은 기준으로 잡아야 한다.
describe('hasLoginOnlyFilter', () => {
  it.each(['isBookmarked', 'isLiked', 'isMyPosts', 'isPrivate'])(
    '범위 칩 값 %s 하나만 있어도 로그인 전용으로 본다',
    (filter) => {
      expect(hasLoginOnlyFilter(filter)).toBe(true);
    }
  );

  it('다른 값과 섞여 있어도 로그인 전용 값이 하나라도 있으면 참이다', () => {
    expect(hasLoginOnlyFilter('excludeBots,isLiked')).toBe(true);
  });

  it('쉼표로 나눈 값의 앞뒤 공백을 떼고 본다', () => {
    expect(hasLoginOnlyFilter(' isMyPosts')).toBe(true);
    expect(hasLoginOnlyFilter('excludeBots, isPrivate ,')).toBe(true);
  });

  it('필터가 없거나 로그인과 무관한 값만 있으면 거짓이다', () => {
    expect(hasLoginOnlyFilter(undefined)).toBe(false);
    expect(hasLoginOnlyFilter('')).toBe(false);
    expect(hasLoginOnlyFilter('excludeBots')).toBe(false);
  });

  it('값의 일부만 겹치는 이름은 로그인 전용으로 보지 않는다', () => {
    expect(hasLoginOnlyFilter('isLikedByOthers')).toBe(false);
  });
});
