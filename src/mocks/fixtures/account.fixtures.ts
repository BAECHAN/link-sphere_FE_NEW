import type { Account } from '@/entities/account/model/account.schema';

export const mockAccount: Account = {
  id: 'user-uuid-1',
  nickname: 'testuser',
  image: undefined,
  role: 'USER',
};

export const mockOtherAccount: Account = {
  id: 'user-uuid-2',
  nickname: 'otheruser',
  image: undefined,
  role: 'USER',
};
