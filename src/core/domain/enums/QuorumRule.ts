export const QuorumRule = {
  UNANIMOUS: 'UNANIMOUS',
  MAJORITY: 'MAJORITY',
  FIXED_COUNT: 'FIXED_COUNT',
} as const;

export type QuorumRule = (typeof QuorumRule)[keyof typeof QuorumRule];
