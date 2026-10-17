import { randomUUID } from 'node:crypto';
import { UserMoviePreference } from '../../../core/domain/entities/UserMoviePreference.js';
import { PreferenceStatus } from '../../../core/domain/enums/PreferenceStatus.js';

export interface UpsertPreferenceResult {
  readonly preference: UserMoviePreference;
  readonly isNew: boolean;
}

export interface PreferenceFilter {
  readonly status?: PreferenceStatus | undefined;
  readonly excludeSkipped?: boolean | undefined;
}

export interface PreferenceRepository {
  upsert(
    userId: string,
    movieId: number,
    status: PreferenceStatus,
  ): Promise<UpsertPreferenceResult>;
  findByUserAndMovie(userId: string, movieId: number): Promise<UserMoviePreference | null>;
  findByUserId(
    userId: string,
    filter?: PreferenceFilter,
  ): Promise<readonly UserMoviePreference[]>;
  findConsensualCandidates(
    userIds: readonly string[],
    movieId: number,
  ): Promise<readonly UserMoviePreference[]>;
  clear(): Promise<void>;
}

export class InMemoryPreferenceRepository implements PreferenceRepository {
  private readonly preferences = new Map<string, UserMoviePreference>();

  private buildKey(userId: string, movieId: number): string {
    return `${userId}:${movieId}`;
  }

  async upsert(
    userId: string,
    movieId: number,
    status: PreferenceStatus,
  ): Promise<UpsertPreferenceResult> {
    const key = this.buildKey(userId, movieId);
    const existing = this.preferences.get(key);
    const now = new Date();

    if (existing) {
      const updated: UserMoviePreference = {
        id: existing.id,
        userId: existing.userId,
        movieId: existing.movieId,
        status,
        createdAt: existing.createdAt,
        updatedAt: now,
      };

      this.preferences.set(key, updated);
      return { preference: updated, isNew: false };
    }

    const created: UserMoviePreference = {
      id: randomUUID(),
      userId,
      movieId,
      status,
      createdAt: now,
      updatedAt: now,
    };

    this.preferences.set(key, created);
    return { preference: created, isNew: true };
  }

  async findByUserAndMovie(userId: string, movieId: number): Promise<UserMoviePreference | null> {
    const key = this.buildKey(userId, movieId);
    return this.preferences.get(key) ?? null;
  }

  async findByUserId(
    userId: string,
    filter?: PreferenceFilter,
  ): Promise<readonly UserMoviePreference[]> {
    const results: UserMoviePreference[] = [];

    for (const preference of this.preferences.values()) {
      if (preference.userId !== userId) {
        continue;
      }

      if (filter?.status !== undefined && preference.status !== filter.status) {
        continue;
      }

      if (filter?.excludeSkipped === true && preference.status === PreferenceStatus.SKIPPED) {
        continue;
      }

      results.push(preference);
    }

    return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async findConsensualCandidates(
    userIds: readonly string[],
    movieId: number,
  ): Promise<readonly UserMoviePreference[]> {
    const userSet = new Set(userIds);
    const candidates: UserMoviePreference[] = [];

    for (const preference of this.preferences.values()) {
      if (
        preference.movieId === movieId &&
        userSet.has(preference.userId) &&
        preference.status === PreferenceStatus.WANT_TO_WATCH
      ) {
        candidates.push(preference);
      }
    }

    return candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async clear(): Promise<void> {
    this.preferences.clear();
  }
}
