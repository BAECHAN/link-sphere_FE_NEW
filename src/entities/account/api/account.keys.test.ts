import { describe, it, expect, vi } from 'vitest';
import { createTestQueryClient } from '@/test/utils';
import { handleAccountUpdateSuccess } from '@/entities/account/api/account.keys';

describe('handleAccountUpdateSuccess', () => {
  it('작성자 정보가 비정규화된 모든 캐시(post·comments·folder posts)를 무효화한다', () => {
    const queryClient = createTestQueryClient();
    vi.spyOn(queryClient, 'invalidateQueries');

    handleAccountUpdateSuccess(queryClient);

    const invalidatedKeys = vi
      .mocked(queryClient.invalidateQueries)
      .mock.calls.map(([arg]) => arg?.queryKey);

    expect(invalidatedKeys).toContainEqual(['post']);
    expect(invalidatedKeys).toContainEqual(['comments']);
    expect(invalidatedKeys).toContainEqual(['folder', 'posts']);
  });
});
