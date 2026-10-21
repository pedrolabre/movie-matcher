import { StreamingProvider } from '../../core/domain/entities/Movie.js';
import {
  NormalizedStreamingProvider,
  MovieWatchProvidersResult,
} from '../../core/domain/types/schemas.js';
import { CacheService } from '../cache/CacheService.js';
import { MemoryCacheService } from '../cache/MemoryCacheService.js';
import { MovieMapper } from './mappers/MovieMapper.js';
import { TmdbClient } from './TmdbClient.js';
import {
  TmdbApiError,
  TmdbCountryWatchProviders,
  TmdbWatchProviderItem,
  TmdbWatchProvidersResponse,
} from './types.js';

export interface CanonicalProviderConfig {
  readonly id: number;
  readonly canonicalName: string;
  readonly slug: string;
  readonly brandColor: string;
  readonly displayPriority: number;
  readonly aliases: readonly string[];
}

export const CANONICAL_PROVIDERS_BR: readonly CanonicalProviderConfig[] = [
  {
    id: 8,
    canonicalName: 'Netflix',
    slug: 'netflix',
    brandColor: '#E50914',
    displayPriority: 1,
    aliases: ['netflix'],
  },
  {
    id: 119,
    canonicalName: 'Prime Video',
    slug: 'prime-video',
    brandColor: '#00A8E1',
    displayPriority: 2,
    aliases: ['amazon prime video', 'prime video', 'amazon video'],
  },
  {
    id: 1899,
    canonicalName: 'Max',
    slug: 'max',
    brandColor: '#002BE7',
    displayPriority: 3,
    aliases: ['max', 'hbo max', 'hbo'],
  },
  {
    id: 384, // HBO Max legacy ID on TMDB
    canonicalName: 'Max',
    slug: 'max',
    brandColor: '#002BE7',
    displayPriority: 3,
    aliases: ['hbo max', 'max'],
  },
  {
    id: 337,
    canonicalName: 'Disney+',
    slug: 'disney-plus',
    brandColor: '#113CCF',
    displayPriority: 4,
    aliases: ['disney+', 'disney plus', 'disney'],
  },
  {
    id: 350,
    canonicalName: 'Apple TV+',
    slug: 'apple-tv-plus',
    brandColor: '#000000',
    displayPriority: 5,
    aliases: ['apple tv+', 'apple tv plus', 'apple tv'],
  },
  {
    id: 307,
    canonicalName: 'Globoplay',
    slug: 'globoplay',
    brandColor: '#E31C23',
    displayPriority: 6,
    aliases: ['globoplay', 'globo play'],
  },
  {
    id: 531,
    canonicalName: 'Paramount+',
    slug: 'paramount-plus',
    brandColor: '#0064FF',
    displayPriority: 7,
    aliases: ['paramount+', 'paramount plus', 'paramount'],
  },
  {
    id: 227,
    canonicalName: 'Telecine',
    slug: 'telecine',
    brandColor: '#ED1C24',
    displayPriority: 8,
    aliases: ['telecine', 'telecine play'],
  },
  {
    id: 619,
    canonicalName: 'Star+',
    slug: 'star-plus',
    brandColor: '#0B0B0F',
    displayPriority: 9,
    aliases: ['star+', 'star plus'],
  },
  {
    id: 167,
    canonicalName: 'Claro video',
    slug: 'claro-video',
    brandColor: '#DA291C',
    displayPriority: 10,
    aliases: ['claro video', 'claro tv+'],
  },
  {
    id: 283,
    canonicalName: 'Crunchyroll',
    slug: 'crunchyroll',
    brandColor: '#F47521',
    displayPriority: 11,
    aliases: ['crunchyroll'],
  },
];

export function findCanonicalProvider(
  providerId: number,
  providerName?: string,
): CanonicalProviderConfig | null {
  // 1. Busca por providerId exato
  const byId = CANONICAL_PROVIDERS_BR.find((p) => p.id === providerId);
  if (byId) {
    return byId;
  }

  // 2. Busca por alias do nome
  if (providerName) {
    const normalizedName = providerName.trim().toLowerCase();
    const byAlias = CANONICAL_PROVIDERS_BR.find((p) =>
      p.aliases.some((alias) => alias.toLowerCase() === normalizedName),
    );
    if (byAlias) {
      return byAlias;
    }
  }

  return null;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function normalizeStreamingProvider(
  raw: TmdbWatchProviderItem | StreamingProvider,
  imageBaseUrl = 'https://image.tmdb.org/t/p',
): NormalizedStreamingProvider {
  const providerId = 'providerId' in raw ? raw.providerId : raw.provider_id;
  const rawName = 'providerName' in raw ? raw.providerName : raw.provider_name;
  const rawLogo = 'logoPath' in raw ? raw.logoPath : (raw as TmdbWatchProviderItem).logo_path;

  const canonical = findCanonicalProvider(providerId, rawName);

  const providerName = canonical ? canonical.canonicalName : (rawName?.trim() || `Provider ${providerId}`);
  const slug = canonical ? canonical.slug : generateSlug(providerName);
  const brandColor = canonical ? canonical.brandColor : '#334155';
  const displayPriority = canonical ? canonical.displayPriority : 99;
  const logoPath = MovieMapper.resolveImageUrl(rawLogo, 'w500', imageBaseUrl);

  return {
    providerId,
    providerName,
    slug,
    brandColor,
    logoPath,
    displayPriority,
  };
}

export function normalizeProviderList(
  providers?: readonly (TmdbWatchProviderItem | StreamingProvider)[] | null,
  imageBaseUrl = 'https://image.tmdb.org/t/p',
): readonly NormalizedStreamingProvider[] {
  if (!providers || !Array.isArray(providers) || providers.length === 0) {
    return [];
  }

  const seenIds = new Set<number>();
  const normalizedList: NormalizedStreamingProvider[] = [];

  for (const item of providers) {
    if (!item) continue;
    const providerId = 'providerId' in item ? item.providerId : item.provider_id;
    if (!providerId || typeof providerId !== 'number' || providerId <= 0) continue;

    const normalized = normalizeStreamingProvider(item, imageBaseUrl);

    // Evita duplicatas pelo ID normalizado
    if (!seenIds.has(normalized.providerId)) {
      seenIds.add(normalized.providerId);
      normalizedList.push(normalized);
    }
  }

  // Ordena por displayPriority ascendente, e depois alfabeticamente
  return normalizedList.sort((a, b) => {
    if (a.displayPriority !== b.displayPriority) {
      return a.displayPriority - b.displayPriority;
    }
    return a.providerName.localeCompare(b.providerName);
  });
}

export function filterFlatrateProviders(
  countryData?: TmdbCountryWatchProviders,
  imageBaseUrl = 'https://image.tmdb.org/t/p',
): readonly NormalizedStreamingProvider[] {
  if (!countryData?.flatrate || !Array.isArray(countryData.flatrate)) {
    return [];
  }
  return normalizeProviderList(countryData.flatrate, imageBaseUrl);
}

export interface WatchProvidersServiceConfig {
  readonly tmdbClient?: TmdbClient | undefined;
  readonly cacheService?: CacheService | undefined;
  readonly defaultRegion?: string | undefined;
  readonly ttlSeconds?: number | undefined;
  readonly imageBaseUrl?: string | undefined;
}

export class WatchProvidersService {
  private readonly tmdbClient: TmdbClient;
  private readonly cache: CacheService;
  private readonly defaultRegion: string;
  private readonly ttlSeconds: number;
  private readonly imageBaseUrl: string;

  constructor(config?: WatchProvidersServiceConfig) {
    this.tmdbClient = config?.tmdbClient ?? new TmdbClient();
    this.cache = config?.cacheService ?? this.tmdbClient.cache ?? new MemoryCacheService();
    this.defaultRegion = config?.defaultRegion ?? 'BR';
    this.ttlSeconds = config?.ttlSeconds ?? 604800; // 7 dias
    this.imageBaseUrl = config?.imageBaseUrl ?? 'https://image.tmdb.org/t/p';
  }

  async getMovieProviders(
    movieId: number,
    region = this.defaultRegion,
  ): Promise<MovieWatchProvidersResult> {
    if (!movieId || movieId <= 0 || !Number.isInteger(movieId)) {
      throw new TmdbApiError(400, 'Invalid movieId');
    }

    const cleanRegion = (region || this.defaultRegion).toUpperCase().trim();
    const cacheKey = `tmdb:providers:${movieId}:${cleanRegion}`;

    const cached = await this.cache.get<MovieWatchProvidersResult>(cacheKey);
    if (cached) {
      return cached;
    }

    let response: TmdbWatchProvidersResponse;
    try {
      response = await this.tmdbClient.getWatchProviders(movieId);
    } catch (error) {
      if (error instanceof TmdbApiError && error.statusCode === 404) {
        throw error;
      }
      throw error;
    }

    const countryData = response.results?.[cleanRegion];
    const flatrate = normalizeProviderList(countryData?.flatrate, this.imageBaseUrl);
    const rent = normalizeProviderList(countryData?.rent, this.imageBaseUrl);
    const buy = normalizeProviderList(countryData?.buy, this.imageBaseUrl);
    const link = countryData?.link ?? null;

    const result: MovieWatchProvidersResult = {
      movieId,
      region: cleanRegion,
      providers: flatrate,
      flatrate,
      rent,
      buy,
      link,
    };

    await this.cache.set(cacheKey, result, this.ttlSeconds);
    return result;
  }

  async getNormalizedFlatrate(
    movieId: number,
    region = this.defaultRegion,
  ): Promise<readonly NormalizedStreamingProvider[]> {
    const result = await this.getMovieProviders(movieId, region);
    return result.flatrate;
  }
}
