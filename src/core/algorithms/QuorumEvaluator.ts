import { QuorumRule } from '../domain/enums/QuorumRule.js';
import { QuorumLevel } from '../domain/enums/QuorumLevel.js';

export interface QuorumEvaluationInput {
  readonly memberCount: number;
  readonly positiveVotesCount: number;
  readonly rule: QuorumRule;
  readonly minPositiveVotes?: number | undefined;
}

export interface QuorumEvaluationResult {
  readonly isMatch: boolean;
  readonly threshold: number;
  readonly positiveVotesCount: number;
  readonly memberCount: number;
  readonly quorumLevel: QuorumLevel | null;
  readonly approvalRatio: number;
}

export function calculateThreshold(
  memberCount: number,
  rule: QuorumRule,
  minPositiveVotes?: number,
): number {
  if (memberCount <= 0) {
    return 0;
  }

  const baseMin =
    typeof minPositiveVotes === 'number' && minPositiveVotes > 0
      ? minPositiveVotes
      : 2;

  switch (rule) {
    case QuorumRule.UNANIMOUS:
      return memberCount;

    case QuorumRule.MAJORITY: {
      const majorityCount = Math.ceil(memberCount / 2);
      return Math.min(memberCount, Math.max(baseMin, majorityCount));
    }

    case QuorumRule.FIXED_COUNT:
      return Math.min(memberCount, Math.max(2, baseMin));

    default:
      return Math.min(memberCount, Math.max(baseMin, Math.ceil(memberCount / 2)));
  }
}

export function determineQuorumLevel(
  memberCount: number,
  positiveVotesCount: number,
  threshold: number,
): QuorumLevel | null {
  if (memberCount < 2 || positiveVotesCount < 2 || positiveVotesCount < threshold) {
    return null;
  }

  if (positiveVotesCount >= memberCount) {
    return QuorumLevel.PERFECT;
  }

  const ratio = positiveVotesCount / memberCount;
  if (
    positiveVotesCount > threshold &&
    (ratio >= 0.6 || positiveVotesCount >= Math.ceil(0.6 * memberCount))
  ) {
    return QuorumLevel.STRONG;
  }

  return QuorumLevel.MINIMUM;
}

export function evaluateQuorum(input: QuorumEvaluationInput): QuorumEvaluationResult {
  const { memberCount, positiveVotesCount, rule, minPositiveVotes } = input;
  const threshold = calculateThreshold(memberCount, rule, minPositiveVotes);
  const isMatch =
    memberCount >= 2 && positiveVotesCount >= 2 && positiveVotesCount >= threshold;
  const quorumLevel = isMatch
    ? determineQuorumLevel(memberCount, positiveVotesCount, threshold)
    : null;
  const approvalRatio = memberCount > 0 ? positiveVotesCount / memberCount : 0;

  return {
    isMatch,
    threshold,
    positiveVotesCount,
    memberCount,
    quorumLevel,
    approvalRatio,
  };
}
