export interface TmdbGenre {
  readonly id: number;
  readonly name: string;
}

export interface TmdbMovieResult {
  readonly id: number;
  readonly title: string;
  readonly original_title?: string | null;
  readonly overview?: string | null;
  readonly poster_path?: string | null;
  readonly backdrop_path?: string | null;
  readonly release_date?: string | null;
  readonly vote_average?: number | null;
  readonly genre_ids?: readonly number[];
  readonly popularity?: number;
  readonly vote_count?: number;
}

export interface TmdbWatchProviderItem {
  readonly provider_id: number;
  readonly provider_name: string;
  readonly logo_path?: string | null;
  readonly display_priority?: number;
}

export interface TmdbCountryWatchProviders {
  readonly link?: string;
  readonly flatrate?: readonly TmdbWatchProviderItem[];
  readonly rent?: readonly TmdbWatchProviderItem[];
  readonly buy?: readonly TmdbWatchProviderItem[];
}

export interface TmdbWatchProvidersResponse {
  readonly id?: number;
  readonly results?: Record<string, TmdbCountryWatchProviders>;
}

export interface TmdbMovieDetailsResponse {
  readonly id: number;
  readonly title: string;
  readonly original_title?: string | null;
  readonly overview?: string | null;
  readonly poster_path?: string | null;
  readonly backdrop_path?: string | null;
  readonly release_date?: string | null;
  readonly runtime?: number | null;
  readonly vote_average?: number | null;
  readonly genres?: readonly TmdbGenre[];
  readonly popularity?: number;
  readonly vote_count?: number;
  readonly status?: string;
  readonly tagline?: string | null;
  readonly 'watch/providers'?: TmdbWatchProvidersResponse;
}

export interface TmdbPaginatedResponse<T> {
  readonly page: number;
  readonly results: readonly T[];
  readonly total_pages: number;
  readonly total_results: number;
}

export class TmdbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TmdbError';
  }
}

export class TmdbRateLimitError extends TmdbError {
  readonly statusCode = 429;
  readonly retryAfterSeconds: number | null;

  constructor(message = 'TMDB API rate limit exceeded', retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'TmdbRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class TmdbApiError extends TmdbError {
  readonly statusCode: number;
  readonly statusMessage?: string | undefined;
  readonly responseBody?: unknown;

  constructor(statusCode: number, statusMessage?: string | undefined, responseBody?: unknown) {
    super(`TMDB API request failed with status ${statusCode}: ${statusMessage ?? 'Unknown error'}`);
    this.name = 'TmdbApiError';
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
    this.responseBody = responseBody;
  }
}

export class TmdbConfigurationError extends TmdbError {
  constructor(message = 'TMDB API key is not configured') {
    super(message);
    this.name = 'TmdbConfigurationError';
  }
}
