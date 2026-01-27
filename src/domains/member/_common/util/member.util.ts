import { MemberRole } from '../model/member.schema';

export const isMemberRole = (role: unknown): role is MemberRole => {
  return typeof role === 'string' && ['ADMIN', 'USER'].includes(role);
};
