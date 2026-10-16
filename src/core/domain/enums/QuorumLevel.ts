export const QuorumLevel = {
  MINIMUM: 'MINIMUM',
  STRONG: 'STRONG',
  PERFECT: 'PERFECT',
} as const;

export type QuorumLevel = (typeof QuorumLevel)[keyof typeof QuorumLevel];
