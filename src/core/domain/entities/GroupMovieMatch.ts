import type { QuorumLevel } from '../enums/QuorumLevel.js';
import type { MatchStatus } from '../enums/MatchStatus.js';

export interface GroupMovieMatch {
  readonly id: string;
  readonly groupId: string;
  readonly movieId: number;
  readonly positiveVotesCount: number;
  readonly quorumLevel: QuorumLevel;
  readonly status: MatchStatus;
  readonly matchedAt: Date;
  readonly updatedAt: Date;
}
