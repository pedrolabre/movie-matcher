import { UserMoviePreference } from '../domain/entities/UserMoviePreference.js';
import { PreferenceStatus } from '../domain/enums/PreferenceStatus.js';
import { GroupSafePreferenceDto } from '../domain/types/schemas.js';
import {
  InMemoryPreferenceRepository,
  PreferenceRepository,
  UpsertPreferenceResult,
} from '../../infrastructure/database/repositories/PreferenceRepository.js';

export interface GetPreferencesOptions {
  readonly status?: PreferenceStatus | undefined;
  readonly includeSkipped?: boolean | undefined;
}

export class PreferenceService {
  private readonly repository: PreferenceRepository;

  constructor(repository?: PreferenceRepository) {
    this.repository = repository ?? new InMemoryPreferenceRepository();
  }

  async recordPreference(
    userId: string,
    movieId: number,
    status: PreferenceStatus,
  ): Promise<UpsertPreferenceResult> {
    return this.repository.upsert(userId, movieId, status);
  }

  async getUserPreferences(
    userId: string,
    options?: GetPreferencesOptions,
  ): Promise<readonly UserMoviePreference[]> {
    const excludeSkipped = options?.includeSkipped === false;
    return this.repository.findByUserId(userId, {
      status: options?.status,
      excludeSkipped,
    });
  }

  async getUserWatchlist(userId: string): Promise<readonly UserMoviePreference[]> {
    return this.repository.findByUserId(userId, {
      status: PreferenceStatus.WANT_TO_WATCH,
    });
  }

  async getUserHistory(userId: string): Promise<readonly UserMoviePreference[]> {
    return this.repository.findByUserId(userId, {
      status: PreferenceStatus.ALREADY_WATCHED,
    });
  }

  async getUserPreferenceForMovie(
    userId: string,
    movieId: number,
  ): Promise<UserMoviePreference | null> {
    return this.repository.findByUserAndMovie(userId, movieId);
  }

  async getConsensualCandidates(
    userIds: readonly string[],
    movieId: number,
  ): Promise<readonly GroupSafePreferenceDto[]> {
    const candidates = await this.repository.findConsensualCandidates(userIds, movieId);
    const safeDtos: GroupSafePreferenceDto[] = [];

    for (const candidate of candidates) {
      const safeDto = this.sanitizeForGroup(candidate);
      if (safeDto !== null) {
        safeDtos.push(safeDto);
      }
    }

    return safeDtos;
  }

  async countPositivePreferences(
    movieId: number,
    userIds: readonly string[],
  ): Promise<number> {
    const candidates = await this.getConsensualCandidates(userIds, movieId);
    return candidates.length;
  }

  sanitizeForGroup(preference: UserMoviePreference): GroupSafePreferenceDto | null {
    if (preference.status !== PreferenceStatus.WANT_TO_WATCH) {
      return null;
    }

    return {
      userId: preference.userId,
      movieId: preference.movieId,
      status: PreferenceStatus.WANT_TO_WATCH,
      votedAt: preference.createdAt,
    };
  }
}
