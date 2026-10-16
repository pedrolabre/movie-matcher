import { Movie, MovieGenre, StreamingProvider } from '../../../core/domain/entities/Movie.js';
import {
  TmdbMovieDetailsResponse,
  TmdbMovieResult,
  TmdbWatchProvidersResponse,
} from '../types.js';

export interface MovieMapperOptions {
  readonly imageBaseUrl?: string;
  readonly posterSize?: string;
  readonly backdropSize?: string;
  readonly defaultRegion?: string;
  readonly genreMap?: Record<number, string>;
  readonly syncedAt?: Date;
}

const DEFAULT_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const DEFAULT_POSTER_SIZE = 'w500';
const DEFAULT_BACKDROP_SIZE = 'original';
const DEFAULT_REGION = 'BR';

const DEFAULT_GENRE_MAP: Record<number, string> = {
  28: 'Ação',
  12: 'Aventura',
  16: 'Animação',
  35: 'Comédia',
  80: 'Crime',
  99: 'Documentário',
  18: 'Drama',
  10751: 'Família',
  14: 'Fantasia',
  36: 'História',
  27: 'Terror',
  10402: 'Música',
  9648: 'Mistério',
  10749: 'Romance',
  878: 'Ficção científica',
  10770: 'Cinema TV',
  53: 'Thriller',
  10752: 'Guerra',
  37: 'Faroeste',
};

export class MovieMapper {
  static resolveImageUrl(
    path?: string | null,
    size = DEFAULT_POSTER_SIZE,
    baseUrl = DEFAULT_IMAGE_BASE_URL,
  ): string | null {
    if (!path) {
      return null;
    }

    const trimmed = path.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}/${size}${normalizedPath}`;
  }

  static sanitizeOverview(overview?: string | null): string | null {
    if (!overview) {
      return null;
    }

    const trimmed = overview.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  static extractReleaseYear(dateString?: string | null): number | null {
    if (!dateString) {
      return null;
    }

    const trimmed = dateString.trim();
    if (!trimmed) {
      return null;
    }

    const [yearPart] = trimmed.split('-');
    if (!yearPart) {
      return null;
    }

    const parsedYear = Number.parseInt(yearPart, 10);
    if (Number.isNaN(parsedYear) || parsedYear < 1888 || parsedYear > 2100) {
      return null;
    }

    return parsedYear;
  }

  static mapWatchProviders(
    providersResponse?: TmdbWatchProvidersResponse,
    region = DEFAULT_REGION,
    imageBaseUrl = DEFAULT_IMAGE_BASE_URL,
  ): readonly StreamingProvider[] {
    if (!providersResponse?.results) {
      return [];
    }

    const regionData = providersResponse.results[region];
    if (!regionData?.flatrate || !Array.isArray(regionData.flatrate)) {
      return [];
    }

    return regionData.flatrate
      .filter((item) => item && typeof item.provider_id === 'number' && item.provider_id > 0)
      .map((item) => ({
        providerId: item.provider_id,
        providerName: item.provider_name.trim(),
        logoPath: MovieMapper.resolveImageUrl(item.logo_path, 'w500', imageBaseUrl),
      }));
  }

  static toDomainFromDetails(
    raw: TmdbMovieDetailsResponse,
    providersOverride?: TmdbWatchProvidersResponse,
    options?: MovieMapperOptions,
  ): Movie {
    const imageBaseUrl = options?.imageBaseUrl ?? DEFAULT_IMAGE_BASE_URL;
    const posterSize = options?.posterSize ?? DEFAULT_POSTER_SIZE;
    const backdropSize = options?.backdropSize ?? DEFAULT_BACKDROP_SIZE;
    const region = options?.defaultRegion ?? DEFAULT_REGION;

    const title = (raw.title?.trim() || raw.original_title?.trim() || 'Sem título').slice(0, 255);
    const originalTitle = raw.original_title?.trim() ? raw.original_title.trim().slice(0, 255) : null;

    const genres: MovieGenre[] = Array.isArray(raw.genres)
      ? raw.genres
          .filter((g) => g && typeof g.id === 'number' && g.id > 0 && typeof g.name === 'string' && g.name.trim().length > 0)
          .map((g) => ({ id: g.id, name: g.name.trim() }))
      : [];

    const effectiveProviders = providersOverride ?? raw['watch/providers'];
    const streamingProviders = MovieMapper.mapWatchProviders(effectiveProviders, region, imageBaseUrl);

    const runtimeMinutes =
      typeof raw.runtime === 'number' && raw.runtime > 0 && Number.isFinite(raw.runtime)
        ? Math.floor(raw.runtime)
        : null;

    let voteAverage: number | null = null;
    if (typeof raw.vote_average === 'number' && Number.isFinite(raw.vote_average)) {
      const clamped = Math.max(0, Math.min(10, raw.vote_average));
      voteAverage = Math.round(clamped * 10) / 10;
    }

    return {
      tmdbId: raw.id,
      title,
      originalTitle,
      overview: MovieMapper.sanitizeOverview(raw.overview),
      posterPath: MovieMapper.resolveImageUrl(raw.poster_path, posterSize, imageBaseUrl),
      backdropPath: MovieMapper.resolveImageUrl(raw.backdrop_path, backdropSize, imageBaseUrl),
      releaseYear: MovieMapper.extractReleaseYear(raw.release_date),
      runtimeMinutes,
      voteAverage,
      genres,
      streamingProviders,
      syncedAt: options?.syncedAt ?? new Date(),
    };
  }

  static toDomainFromList(
    raw: TmdbMovieResult,
    options?: MovieMapperOptions,
  ): Movie {
    const imageBaseUrl = options?.imageBaseUrl ?? DEFAULT_IMAGE_BASE_URL;
    const posterSize = options?.posterSize ?? DEFAULT_POSTER_SIZE;
    const backdropSize = options?.backdropSize ?? DEFAULT_BACKDROP_SIZE;
    const genreMap = { ...DEFAULT_GENRE_MAP, ...(options?.genreMap ?? {}) };

    const title = (raw.title?.trim() || raw.original_title?.trim() || 'Sem título').slice(0, 255);
    const originalTitle = raw.original_title?.trim() ? raw.original_title.trim().slice(0, 255) : null;

    const genres: MovieGenre[] = Array.isArray(raw.genre_ids)
      ? raw.genre_ids
          .filter((id) => typeof id === 'number' && id > 0)
          .map((id) => ({
            id,
            name: genreMap[id] ?? `Gênero ${id}`,
          }))
      : [];

    let voteAverage: number | null = null;
    if (typeof raw.vote_average === 'number' && Number.isFinite(raw.vote_average)) {
      const clamped = Math.max(0, Math.min(10, raw.vote_average));
      voteAverage = Math.round(clamped * 10) / 10;
    }

    return {
      tmdbId: raw.id,
      title,
      originalTitle,
      overview: MovieMapper.sanitizeOverview(raw.overview),
      posterPath: MovieMapper.resolveImageUrl(raw.poster_path, posterSize, imageBaseUrl),
      backdropPath: MovieMapper.resolveImageUrl(raw.backdrop_path, backdropSize, imageBaseUrl),
      releaseYear: MovieMapper.extractReleaseYear(raw.release_date),
      runtimeMinutes: null,
      voteAverage,
      genres,
      streamingProviders: [],
      syncedAt: options?.syncedAt ?? new Date(),
    };
  }
}
