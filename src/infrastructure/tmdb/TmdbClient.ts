import { Movie } from '../../core/domain/entities/Movie.js';
import { CacheService } from '../cache/CacheService.js';
import { MemoryCacheService } from '../cache/MemoryCacheService.js';
import { MovieMapper } from './mappers/MovieMapper.js';
import {
  TmdbApiError,
  TmdbConfigurationError,
  TmdbMovieDetailsResponse,
  TmdbMovieResult,
  TmdbPaginatedResponse,
  TmdbRateLimitError,
} from './types.js';

export interface TmdbClientConfig {
  readonly apiKey?: string;
  readonly cacheService?: CacheService;
  readonly baseUrl?: string;
  readonly defaultLanguage?: string;
  readonly defaultRegion?: string;
  readonly catalogTtlSeconds?: number;
  readonly detailsTtlSeconds?: number;
}

export interface PaginatedMoviesResult {
  readonly movies: readonly Movie[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalResults: number;
}

export class TmdbClient {
  public readonly cache: CacheService;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultLanguage: string;
  private readonly defaultRegion: string;
  private readonly catalogTtlSeconds: number;
  private readonly detailsTtlSeconds: number;

  constructor(config?: TmdbClientConfig) {
    this.apiKey = config?.apiKey ?? process.env.TMDB_API_KEY ?? '';
    this.cache = config?.cacheService ?? new MemoryCacheService();
    this.baseUrl = (config?.baseUrl ?? 'https://api.themoviedb.org/3').replace(/\/+$/, '');
    this.defaultLanguage = config?.defaultLanguage ?? 'pt-BR';
    this.defaultRegion = config?.defaultRegion ?? 'BR';
    this.catalogTtlSeconds = config?.catalogTtlSeconds ?? 86400;
    this.detailsTtlSeconds = config?.detailsTtlSeconds ?? 604800;
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new TmdbConfigurationError();
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${cleanEndpoint}`);

    url.searchParams.set('api_key', this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new TmdbApiError(0, error.message);
      }
      throw new TmdbApiError(0, 'Network request failed');
    }

    if (response.status === 429) {
      const retryHeader = response.headers.get('retry-after');
      const retryParsed = retryHeader ? Number.parseInt(retryHeader, 10) : null;
      const retryAfterSeconds = Number.isFinite(retryParsed) ? retryParsed : null;
      throw new TmdbRateLimitError('TMDB API rate limit exceeded', retryAfterSeconds);
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => null);
      }
      throw new TmdbApiError(response.status, response.statusText, errorBody);
    }

    return (await response.json()) as T;
  }

  async getPopularMovies(page = 1): Promise<PaginatedMoviesResult> {
    const safePage = Math.max(1, Math.floor(page));
    const cacheKey = `tmdb:popular:page:${safePage}:lang:${this.defaultLanguage}`;

    const cached = await this.cache.get<PaginatedMoviesResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.request<TmdbPaginatedResponse<TmdbMovieResult>>('/movie/popular', {
      page: String(safePage),
      language: this.defaultLanguage,
    });

    const movies = data.results.map((result) => MovieMapper.toDomainFromList(result));
    const result: PaginatedMoviesResult = {
      movies,
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };

    await this.cache.set(cacheKey, result, this.catalogTtlSeconds);
    return result;
  }

  async searchMovies(query: string, page = 1): Promise<PaginatedMoviesResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        movies: [],
        page: 1,
        totalPages: 0,
        totalResults: 0,
      };
    }

    const safePage = Math.max(1, Math.floor(page));
    const cacheKey = `tmdb:search:q:${encodeURIComponent(trimmed.toLowerCase())}:page:${safePage}:lang:${this.defaultLanguage}`;

    const cached = await this.cache.get<PaginatedMoviesResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.request<TmdbPaginatedResponse<TmdbMovieResult>>('/search/movie', {
      query: trimmed,
      page: String(safePage),
      language: this.defaultLanguage,
    });

    const movies = data.results.map((result) => MovieMapper.toDomainFromList(result));
    const result: PaginatedMoviesResult = {
      movies,
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };

    await this.cache.set(cacheKey, result, this.catalogTtlSeconds);
    return result;
  }

  async getMovieDetails(movieId: number): Promise<Movie> {
    if (!movieId || movieId <= 0 || !Number.isInteger(movieId)) {
      throw new TmdbApiError(400, 'Invalid movieId');
    }

    const cacheKey = `tmdb:movie:${movieId}:lang:${this.defaultLanguage}`;
    const cached = await this.cache.get<Movie>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.request<TmdbMovieDetailsResponse>(`/movie/${movieId}`, {
      language: this.defaultLanguage,
      append_to_response: 'watch/providers',
    });

    const movie = MovieMapper.toDomainFromDetails(data, undefined, {
      defaultRegion: this.defaultRegion,
    });

    await this.cache.set(cacheKey, movie, this.detailsTtlSeconds);
    return movie;
  }
}
