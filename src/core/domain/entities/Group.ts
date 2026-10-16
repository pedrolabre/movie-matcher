import type { QuorumRule } from '../enums/QuorumRule.js';

export interface Group {
  readonly id: string;
  readonly name: string;
  readonly inviteCode: string;
  readonly createdBy: string;
  readonly thresholdRule: QuorumRule;
  readonly minPositiveVotes: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
