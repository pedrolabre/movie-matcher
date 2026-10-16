export const GroupRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type GroupRole = (typeof GroupRole)[keyof typeof GroupRole];
