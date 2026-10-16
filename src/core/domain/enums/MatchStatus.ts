export const MatchStatus = {
  ACTIVE: 'ACTIVE',
  SCHEDULED: 'SCHEDULED',
  WATCHED: 'WATCHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];
