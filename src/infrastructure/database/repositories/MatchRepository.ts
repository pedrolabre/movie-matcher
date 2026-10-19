import { randomUUID } from 'node:crypto';
import { GroupMovieMatch } from '../../../core/domain/entities/GroupMovieMatch.js';
import { MatchStatus } from '../../../core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../../core/domain/enums/QuorumLevel.js';

export interface GroupMatchVoter {
  readonly id: string;
  readonly matchId: string;
  readonly userId: string;
  readonly votedAt: Date;
}

export interface MatchWithVoters {
  readonly match: GroupMovieMatch;
  readonly voterUserIds: readonly string[];
}

export interface MatchFilter {
  readonly status?: MatchStatus | undefined;
  readonly movieId?: number | undefined;
}

export interface UpsertMatchInput {
  readonly id?: string | undefined;
  readonly groupId: string;
  readonly movieId: number;
  readonly positiveVotesCount: number;
  readonly quorumLevel: QuorumLevel;
  readonly status?: MatchStatus | undefined;
  readonly matchedAt?: Date | undefined;
  readonly updatedAt?: Date | undefined;
}

export interface MatchRepository {
  upsertMatch(
    input: UpsertMatchInput,
    voterUserIds?: readonly string[],
  ): Promise<GroupMovieMatch>;

  findMatchById(matchId: string): Promise<GroupMovieMatch | null>;
  findMatchByGroupAndMovie(groupId: string, movieId: number): Promise<GroupMovieMatch | null>;
  findMatchesByGroupId(
    groupId: string,
    filter?: MatchFilter,
  ): Promise<readonly GroupMovieMatch[]>;
  findMatchWithVoters(groupId: string, movieId: number): Promise<MatchWithVoters | null>;
  findMatchWithVotersById(matchId: string): Promise<MatchWithVoters | null>;
  getVotersByMatchId(matchId: string): Promise<readonly GroupMatchVoter[]>;
  updateMatchStatus(matchId: string, status: MatchStatus): Promise<GroupMovieMatch | null>;
  deleteMatch(matchId: string): Promise<boolean>;
  deleteMatchByGroupAndMovie(groupId: string, movieId: number): Promise<boolean>;
  clear(): Promise<void>;
}

export class InMemoryMatchRepository implements MatchRepository {
  private readonly matches = new Map<string, GroupMovieMatch>();
  private readonly groupMovieIndex = new Map<string, string>(); // groupId:movieId -> matchId
  private readonly voters = new Map<string, GroupMatchVoter>(); // matchId:userId -> GroupMatchVoter

  private buildGroupMovieKey(groupId: string, movieId: number): string {
    return `${groupId}:${movieId}`;
  }

  private buildVoterKey(matchId: string, userId: string): string {
    return `${matchId}:${userId}`;
  }

  async upsertMatch(
    input: UpsertMatchInput,
    voterUserIds: readonly string[] = [],
  ): Promise<GroupMovieMatch> {
    const key = this.buildGroupMovieKey(input.groupId, input.movieId);
    const existingMatchId = this.groupMovieIndex.get(key);
    const now = new Date();

    let savedMatch: GroupMovieMatch;

    if (existingMatchId && this.matches.has(existingMatchId)) {
      const existing = this.matches.get(existingMatchId)!;
      savedMatch = {
        id: existing.id,
        groupId: existing.groupId,
        movieId: existing.movieId,
        positiveVotesCount: input.positiveVotesCount,
        quorumLevel: input.quorumLevel,
        status: input.status ?? existing.status,
        matchedAt: existing.matchedAt,
        updatedAt: input.updatedAt ?? now,
      };
      this.matches.set(existing.id, savedMatch);
    } else {
      const matchId = input.id ?? randomUUID();
      savedMatch = {
        id: matchId,
        groupId: input.groupId,
        movieId: input.movieId,
        positiveVotesCount: input.positiveVotesCount,
        quorumLevel: input.quorumLevel,
        status: input.status ?? MatchStatus.ACTIVE,
        matchedAt: input.matchedAt ?? now,
        updatedAt: input.updatedAt ?? now,
      };
      this.matches.set(matchId, savedMatch);
      this.groupMovieIndex.set(key, matchId);
    }

    // Atualiza ou insere votantes associados
    if (voterUserIds.length > 0) {
      for (const userId of voterUserIds) {
        const voterKey = this.buildVoterKey(savedMatch.id, userId);
        if (!this.voters.has(voterKey)) {
          this.voters.set(voterKey, {
            id: randomUUID(),
            matchId: savedMatch.id,
            userId,
            votedAt: now,
          });
        }
      }
    }

    return savedMatch;
  }

  async findMatchById(matchId: string): Promise<GroupMovieMatch | null> {
    return this.matches.get(matchId) ?? null;
  }

  async findMatchByGroupAndMovie(
    groupId: string,
    movieId: number,
  ): Promise<GroupMovieMatch | null> {
    const key = this.buildGroupMovieKey(groupId, movieId);
    const matchId = this.groupMovieIndex.get(key);
    if (!matchId) {
      return null;
    }
    return this.matches.get(matchId) ?? null;
  }

  async findMatchesByGroupId(
    groupId: string,
    filter?: MatchFilter,
  ): Promise<readonly GroupMovieMatch[]> {
    const results: GroupMovieMatch[] = [];

    for (const match of this.matches.values()) {
      if (match.groupId !== groupId) {
        continue;
      }

      if (filter?.status !== undefined && match.status !== filter.status) {
        continue;
      }

      if (filter?.movieId !== undefined && match.movieId !== filter.movieId) {
        continue;
      }

      results.push(match);
    }

    return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async findMatchWithVoters(
    groupId: string,
    movieId: number,
  ): Promise<MatchWithVoters | null> {
    const match = await this.findMatchByGroupAndMovie(groupId, movieId);
    if (!match) {
      return null;
    }

    const voters = await this.getVotersByMatchId(match.id);
    return {
      match,
      voterUserIds: voters.map((v) => v.userId),
    };
  }

  async findMatchWithVotersById(matchId: string): Promise<MatchWithVoters | null> {
    const match = await this.findMatchById(matchId);
    if (!match) {
      return null;
    }

    const voters = await this.getVotersByMatchId(match.id);
    return {
      match,
      voterUserIds: voters.map((v) => v.userId),
    };
  }

  async getVotersByMatchId(matchId: string): Promise<readonly GroupMatchVoter[]> {
    const results: GroupMatchVoter[] = [];
    for (const voter of this.voters.values()) {
      if (voter.matchId === matchId) {
        results.push(voter);
      }
    }
    return results.sort((a, b) => a.votedAt.getTime() - b.votedAt.getTime());
  }

  async updateMatchStatus(
    matchId: string,
    status: MatchStatus,
  ): Promise<GroupMovieMatch | null> {
    const match = this.matches.get(matchId);
    if (!match) {
      return null;
    }

    const updated: GroupMovieMatch = {
      ...match,
      status,
      updatedAt: new Date(),
    };

    this.matches.set(matchId, updated);
    return updated;
  }

  async deleteMatch(matchId: string): Promise<boolean> {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    const key = this.buildGroupMovieKey(match.groupId, match.movieId);
    this.groupMovieIndex.delete(key);
    this.matches.delete(matchId);

    // Remove votantes associados
    for (const [voterKey, voter] of this.voters.entries()) {
      if (voter.matchId === matchId) {
        this.voters.delete(voterKey);
      }
    }

    return true;
  }

  async deleteMatchByGroupAndMovie(groupId: string, movieId: number): Promise<boolean> {
    const key = this.buildGroupMovieKey(groupId, movieId);
    const matchId = this.groupMovieIndex.get(key);
    if (!matchId) {
      return false;
    }
    return this.deleteMatch(matchId);
  }

  async clear(): Promise<void> {
    this.matches.clear();
    this.groupMovieIndex.clear();
    this.voters.clear();
  }
}
