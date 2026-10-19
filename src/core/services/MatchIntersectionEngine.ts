import { GroupMovieMatch } from '../domain/entities/GroupMovieMatch.js';
import { MatchStatus } from '../domain/enums/MatchStatus.js';
import { QuorumLevel } from '../domain/enums/QuorumLevel.js';
import { evaluateQuorum, QuorumEvaluationResult } from '../algorithms/QuorumEvaluator.js';
import { PreferenceRepository } from '../../infrastructure/database/repositories/PreferenceRepository.js';
import { GroupRepository } from '../../infrastructure/database/repositories/GroupRepository.js';
import {
  MatchFilter,
  MatchRepository,
  MatchWithVoters,
} from '../../infrastructure/database/repositories/MatchRepository.js';

export interface MatchEvaluationSummary {
  readonly groupId: string;
  readonly groupName: string;
  readonly movieId: number;
  readonly isMatch: boolean;
  readonly quorumLevel: QuorumLevel | null;
  readonly positiveVotesCount: number;
  readonly memberCount: number;
  readonly threshold: number;
  readonly match: GroupMovieMatch | null;
  readonly isNewMatch: boolean;
  readonly voterUserIds: readonly string[];
}

export interface EvaluateMovieResult {
  readonly userId: string;
  readonly movieId: number;
  readonly evaluatedGroupsCount: number;
  readonly matches: readonly MatchEvaluationSummary[];
  readonly matchedGroupIds: readonly string[];
}

export class MatchIntersectionEngine {
  constructor(
    private readonly preferenceRepository: PreferenceRepository,
    private readonly groupRepository: GroupRepository,
    private readonly matchRepository: MatchRepository,
  ) {}

  async evaluateMovieForUserGroups(
    userId: string,
    movieId: number,
  ): Promise<EvaluateMovieResult> {
    const memberships = await this.groupRepository.findGroupsByUserId(userId);
    const summaries: MatchEvaluationSummary[] = [];
    const matchedGroupIds: string[] = [];

    for (const membership of memberships) {
      const summary = await this.evaluateMovieForGroup(membership.group.id, movieId);
      summaries.push(summary);

      if (summary.isMatch && summary.isNewMatch) {
        matchedGroupIds.push(membership.group.id);
      }
    }

    return {
      userId,
      movieId,
      evaluatedGroupsCount: memberships.length,
      matches: summaries,
      matchedGroupIds,
    };
  }

  async evaluateMovieForGroup(
    groupId: string,
    movieId: number,
  ): Promise<MatchEvaluationSummary> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      return {
        groupId,
        groupName: 'Unknown Group',
        movieId,
        isMatch: false,
        quorumLevel: null,
        positiveVotesCount: 0,
        memberCount: 0,
        threshold: 0,
        match: null,
        isNewMatch: false,
        voterUserIds: [],
      };
    }

    const members = await this.groupRepository.findMembersByGroupId(groupId);
    const memberCount = members.length;
    const memberUserIds = members.map((member) => member.userId);

    // Consulta estrita: apenas preferências WANT_TO_WATCH de membros ativos
    const positivePreferences = await this.preferenceRepository.findConsensualCandidates(
      memberUserIds,
      movieId,
    );

    const voterUserIds = positivePreferences.map((p) => p.userId);
    const positiveVotesCount = voterUserIds.length;

    const evaluation: QuorumEvaluationResult = evaluateQuorum({
      memberCount,
      positiveVotesCount,
      rule: group.thresholdRule,
      minPositiveVotes: group.minPositiveVotes,
    });

    const existingMatch = await this.matchRepository.findMatchByGroupAndMovie(
      groupId,
      movieId,
    );

    if (evaluation.isMatch && evaluation.quorumLevel) {
      const isNewMatch =
        !existingMatch || existingMatch.status !== MatchStatus.ACTIVE;

      const savedMatch = await this.matchRepository.upsertMatch(
        {
          groupId,
          movieId,
          positiveVotesCount,
          quorumLevel: evaluation.quorumLevel,
          status: MatchStatus.ACTIVE,
        },
        voterUserIds,
      );

      return {
        groupId: group.id,
        groupName: group.name,
        movieId,
        isMatch: true,
        quorumLevel: evaluation.quorumLevel,
        positiveVotesCount,
        memberCount,
        threshold: evaluation.threshold,
        match: savedMatch,
        isNewMatch,
        voterUserIds,
      };
    }

    // Se não atingiu quórum e existia um match ativo prévio, arquiva/desativa
    let archivedMatch: GroupMovieMatch | null = null;
    if (existingMatch && existingMatch.status === MatchStatus.ACTIVE) {
      archivedMatch = await this.matchRepository.updateMatchStatus(
        existingMatch.id,
        MatchStatus.ARCHIVED,
      );
    }

    return {
      groupId: group.id,
      groupName: group.name,
      movieId,
      isMatch: false,
      quorumLevel: null,
      positiveVotesCount,
      memberCount,
      threshold: evaluation.threshold,
      match: archivedMatch ?? existingMatch,
      isNewMatch: false,
      voterUserIds,
    };
  }

  async getGroupMatches(
    groupId: string,
    filter?: MatchFilter,
  ): Promise<readonly GroupMovieMatch[]> {
    return this.matchRepository.findMatchesByGroupId(groupId, filter);
  }

  async getGroupMatchDetails(
    groupId: string,
    movieId: number,
  ): Promise<MatchWithVoters | null> {
    return this.matchRepository.findMatchWithVoters(groupId, movieId);
  }

  async recalculateGroupMatches(
    groupId: string,
  ): Promise<readonly MatchEvaluationSummary[]> {
    const existingMatches = await this.matchRepository.findMatchesByGroupId(groupId);
    const summaries: MatchEvaluationSummary[] = [];

    for (const match of existingMatches) {
      const summary = await this.evaluateMovieForGroup(groupId, match.movieId);
      summaries.push(summary);
    }

    return summaries;
  }
}
