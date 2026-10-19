import { Movie } from '../domain/entities/Movie.js';
import { UserMoviePreference } from '../domain/entities/UserMoviePreference.js';
import { PreferenceStatus } from '../domain/enums/PreferenceStatus.js';
import { GroupSafePreferenceDto } from '../domain/types/schemas.js';
import {
  InMemoryPreferenceRepository,
  PreferenceRepository,
  UpsertPreferenceResult,
} from '../../infrastructure/database/repositories/PreferenceRepository.js';
import { CatalogService } from './CatalogService.js';
import { MatchIntersectionEngine } from './MatchIntersectionEngine.js';

export interface GetPreferencesOptions {
  readonly status?: PreferenceStatus | undefined;
  readonly includeSkipped?: boolean | undefined;
}

export interface EnrichedUserPreference {
  readonly preference: UserMoviePreference;
  readonly movie: Movie;
}

export interface GetEnrichedPreferencesOptions {
  readonly status?: PreferenceStatus | undefined;
  readonly genreId?: number | undefined;
  readonly search?: string | undefined;
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
}

export interface PaginatedEnrichedPreferences {
  readonly items: readonly EnrichedUserPreference[];
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly totalResults: number;
}

export class PreferenceService {
  private readonly repository: PreferenceRepository;
  private readonly catalogService: CatalogService;
  private readonly intersectionEngine: MatchIntersectionEngine | null;

  constructor(
    repository?: PreferenceRepository,
    catalogService?: CatalogService,
    intersectionEngine?: MatchIntersectionEngine | null,
  ) {
    this.repository = repository ?? new InMemoryPreferenceRepository();
    this.catalogService = catalogService ?? new CatalogService();
    this.intersectionEngine = intersectionEngine ?? null;
  }

  getRepository(): PreferenceRepository {
    return this.repository;
  }

  getCatalogService(): CatalogService {
    return this.catalogService;
  }

  getIntersectionEngine(): MatchIntersectionEngine | null {
    return this.intersectionEngine;
  }

  async recordPreference(
    userId: string,
    movieId: number,
    status: PreferenceStatus,
  ): Promise<UpsertPreferenceResult> {
    const result = await this.repository.upsert(userId, movieId, status);

    let matchesGenerated: readonly string[] = [];
    if (this.intersectionEngine) {
      let movieTitle: string | undefined;
      try {
        const movie = await this.catalogService.getMovieDetails(movieId);
        movieTitle = movie.title;
      } catch {
        // Fallback silencioso em falha de metadados
      }

      const evaluation = await this.intersectionEngine.evaluateMovieForUserGroups(
        userId,
        movieId,
        movieTitle,
      );
      matchesGenerated = evaluation.matchedGroupIds;
    }

    return {
      preference: result.preference,
      isNew: result.isNew,
      matchesGenerated,
    };
  }

  async removePreference(userId: string, movieId: number): Promise<boolean> {
    const removed = await this.repository.delete(userId, movieId);
    if (removed && this.intersectionEngine) {
      await this.intersectionEngine.evaluateMovieForUserGroups(userId, movieId);
    }
    return removed;
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

  async getEnrichedPreferences(
    userId: string,
    options?: GetEnrichedPreferencesOptions,
  ): Promise<PaginatedEnrichedPreferences> {
    const rawPreferences = await this.repository.findByUserId(userId, {
      status: options?.status,
      excludeSkipped: true,
    });

    const enrichedList: EnrichedUserPreference[] = [];

    for (const preference of rawPreferences) {
      let movie: Movie;
      try {
        movie = await this.catalogService.getMovieDetails(preference.movieId);
      } catch {
        movie = {
          tmdbId: preference.movieId,
          title: `Filme #${preference.movieId}`,
          originalTitle: `Movie #${preference.movieId}`,
          overview: 'Sinopse indisponível no momento.',
          posterPath: null,
          backdropPath: null,
          releaseYear: new Date(preference.createdAt).getFullYear(),
          runtimeMinutes: null,
          voteAverage: 0,
          genres: [],
          streamingProviders: [],
          syncedAt: new Date(),
        };
      }

      enrichedList.push({ preference, movie });
    }

    let filtered = enrichedList;

    if (options?.search && options.search.trim().length > 0) {
      const query = options.search.trim().toLowerCase();
      filtered = filtered.filter((item) =>
        item.movie.title.toLowerCase().includes(query),
      );
    }

    if (typeof options?.genreId === 'number') {
      filtered = filtered.filter((item) =>
        item.movie.genres.some((genre) => genre.id === options.genreId),
      );
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? options.limit : 20;
    const totalResults = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / limit));
    const offset = (page - 1) * limit;
    const items = filtered.slice(offset, offset + limit);

    return {
      items,
      page,
      limit,
      totalPages,
      totalResults,
    };
  }

  async getUserEnrichedWatchlist(
    userId: string,
    options?: Omit<GetEnrichedPreferencesOptions, 'status'>,
  ): Promise<PaginatedEnrichedPreferences> {
    return this.getEnrichedPreferences(userId, {
      ...options,
      status: PreferenceStatus.WANT_TO_WATCH,
    });
  }

  async getUserEnrichedHistory(
    userId: string,
    options?: Omit<GetEnrichedPreferencesOptions, 'status'>,
  ): Promise<PaginatedEnrichedPreferences> {
    return this.getEnrichedPreferences(userId, {
      ...options,
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
