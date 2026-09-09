import type { Account } from '@/entities/account/model/account.schema';

export const mockAccount: Account = {
  id: 'user-uuid-1',
  nickname: 'testuser',
  email: 'test@example.com',
  image: undefined,
  role: 'USER',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

export const mockOtherAccount: Account = {
  id: 'user-uuid-2',
  nickname: 'otheruser',
  email: 'other@example.com',
  image: undefined,
  role: 'USER',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};
