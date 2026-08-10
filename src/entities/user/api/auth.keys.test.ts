import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { handleAccountUpdateSuccess } from '@/entities/user/api/auth.keys';

describe('handleAccountUpdateSuccess', () => {
  beforeEach(() => {
    vi.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('작성자 정보가 비정규화된 모든 캐시(post·comments·folder posts)를 무효화한다', () => {
    handleAccountUpdateSuccess();

    const invalidatedKeys = vi
      .mocked(queryClient.invalidateQueries)
      .mock.calls.map(([arg]) => arg?.queryKey);

    expect(invalidatedKeys).toContainEqual(['post']);
    expect(invalidatedKeys).toContainEqual(['comments']);
    expect(invalidatedKeys).toContainEqual(['folder', 'posts']);
  });
});
