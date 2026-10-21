import { describe, expect, it, vi } from 'vitest';
import { MemoryCacheService } from '../../src/infrastructure/cache/MemoryCacheService.js';
import {
  findCanonicalProvider,
  generateSlug,
  normalizeProviderList,
  normalizeStreamingProvider,
  WatchProvidersService,
} from '../../src/infrastructure/tmdb/WatchProvidersService.js';
import {
  TmdbApiError,
  TmdbWatchProvidersResponse,
} from '../../src/infrastructure/tmdb/types.js';
import { TmdbClient } from '../../src/infrastructure/tmdb/TmdbClient.js';

describe('WatchProvidersService', () => {
  describe('generateSlug', () => {
    it('deve converter nomes para slugs kebab-case limpos', () => {
      expect(generateSlug('Prime Video')).toBe('prime-video');
      expect(generateSlug('Apple TV+')).toBe('apple-tv');
      expect(generateSlug('HBO Max / Max')).toBe('hbo-max-max');
      expect(generateSlug('Telecine Play!')).toBe('telecine-play');
    });
  });

  describe('findCanonicalProvider', () => {
    it('deve encontrar provedores canônicos por ID do TMDB', () => {
      const netflix = findCanonicalProvider(8);
      expect(netflix?.canonicalName).toBe('Netflix');
      expect(netflix?.slug).toBe('netflix');
      expect(netflix?.brandColor).toBe('#E50914');
      expect(netflix?.displayPriority).toBe(1);

      const prime = findCanonicalProvider(119);
      expect(prime?.canonicalName).toBe('Prime Video');

      const max = findCanonicalProvider(1899);
      expect(max?.canonicalName).toBe('Max');

      const maxLegacy = findCanonicalProvider(384);
      expect(maxLegacy?.canonicalName).toBe('Max');

      const disney = findCanonicalProvider(337);
      expect(disney?.canonicalName).toBe('Disney+');

      const apple = findCanonicalProvider(350);
      expect(apple?.canonicalName).toBe('Apple TV+');

      const globoplay = findCanonicalProvider(307);
      expect(globoplay?.canonicalName).toBe('Globoplay');
    });

    it('deve encontrar provedores canônicos por aliases do nome', () => {
      expect(findCanonicalProvider(9999, 'Amazon Prime Video')?.canonicalName).toBe('Prime Video');
      expect(findCanonicalProvider(9999, 'HBO Max')?.canonicalName).toBe('Max');
      expect(findCanonicalProvider(9999, 'Disney Plus')?.canonicalName).toBe('Disney+');
      expect(findCanonicalProvider(9999, 'Apple TV Plus')?.canonicalName).toBe('Apple TV+');
      expect(findCanonicalProvider(9999, 'Globo Play')?.canonicalName).toBe('Globoplay');
    });

    it('deve retornar null para provedor desconhecido', () => {
      expect(findCanonicalProvider(99999, 'Canal Desconhecido XYZ')).toBeNull();
    });
  });

  describe('normalizeStreamingProvider', () => {
    it('deve normalizar provedor canônico conhecido com logotipo resolvido em alta resolução', () => {
      const normalized = normalizeStreamingProvider({
        provider_id: 119,
        provider_name: 'Amazon Prime Video',
        logo_path: '/emthp39XA2GUNqUwRXZAnZ5vc9V.jpg',
      });

      expect(normalized.providerId).toBe(119);
      expect(normalized.providerName).toBe('Prime Video');
      expect(normalized.slug).toBe('prime-video');
      expect(normalized.brandColor).toBe('#00A8E1');
      expect(normalized.displayPriority).toBe(2);
      expect(normalized.logoPath).toBe(
        'https://image.tmdb.org/t/p/w500/emthp39XA2GUNqUwRXZAnZ5vc9V.jpg',
      );
    });

    it('deve tratar com fallback provedores não canônicos', () => {
      const normalized = normalizeStreamingProvider({
        provider_id: 8888,
        provider_name: 'Cine Indie BR',
        logo_path: null,
      });

      expect(normalized.providerId).toBe(8888);
      expect(normalized.providerName).toBe('Cine Indie BR');
      expect(normalized.slug).toBe('cine-indie-br');
      expect(normalized.brandColor).toBe('#334155');
      expect(normalized.displayPriority).toBe(99);
      expect(normalized.logoPath).toBeNull();
    });
  });

  describe('normalizeProviderList', () => {
    it('deve normalizar, deduplicar e ordenar por prioridade de exibição canônica', () => {
      const rawList = [
        { provider_id: 307, provider_name: 'Globoplay', logo_path: '/globo.jpg' },
        { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' },
        { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/prime.jpg' },
        { provider_id: 8, provider_name: 'Netflix Duplicado', logo_path: '/netflix.jpg' }, // Duplicata
        { provider_id: 337, provider_name: 'Disney Plus', logo_path: '/disney.jpg' },
        { provider_id: 1899, provider_name: 'Max', logo_path: '/max.jpg' },
        { provider_id: 350, provider_name: 'Apple TV+', logo_path: '/apple.jpg' },
        { provider_id: 9999, provider_name: 'Outro Streaming', logo_path: null },
      ];

      const result = normalizeProviderList(rawList);

      // Deduplicou o Netflix
      expect(result).toHaveLength(7);

      // Ordem canônica correta
      expect(result.map((p) => p.providerName)).toEqual([
        'Netflix',
        'Prime Video',
        'Max',
        'Disney+',
        'Apple TV+',
        'Globoplay',
        'Outro Streaming',
      ]);
    });

    it('deve retornar lista vazia para entradas nulas ou vazias', () => {
      expect(normalizeProviderList(null)).toEqual([]);
      expect(normalizeProviderList(undefined)).toEqual([]);
      expect(normalizeProviderList([])).toEqual([]);
    });
  });

  describe('WatchProvidersService class', () => {
    it('deve recuperar provedores para um filme, normalizar e gravar em cache por 7 dias', async () => {
      const mockTmdbResponse: TmdbWatchProvidersResponse = {
        id: 550,
        results: {
          BR: {
            link: 'https://www.themoviedb.org/movie/550-fight-club/watch?locale=pt-BR',
            flatrate: [
              {
                provider_id: 119,
                provider_name: 'Amazon Prime Video',
                logo_path: '/prime.jpg',
              },
              {
                provider_id: 8,
                provider_name: 'Netflix',
                logo_path: '/netflix.jpg',
              },
            ],
            rent: [
              {
                provider_id: 350,
                provider_name: 'Apple TV',
                logo_path: '/apple.jpg',
              },
            ],
          },
        },
      };

      const mockTmdbClient = {
        getWatchProviders: vi.fn().mockResolvedValue(mockTmdbResponse),
        cache: new MemoryCacheService(),
      } as unknown as TmdbClient;

      const cacheService = new MemoryCacheService();
      const service = new WatchProvidersService({
        tmdbClient: mockTmdbClient,
        cacheService,
      });

      // 1. Chamada inicial (cache miss)
      const result = await service.getMovieProviders(550, 'BR');

      expect(mockTmdbClient.getWatchProviders).toHaveBeenCalledWith(550);
      expect(result.movieId).toBe(550);
      expect(result.region).toBe('BR');
      expect(result.link).toContain('https://www.themoviedb.org/movie/550');
      expect(result.flatrate).toHaveLength(2);
      expect(result.flatrate[0]?.providerName).toBe('Netflix'); // Ordem de prioridade
      expect(result.flatrate[1]?.providerName).toBe('Prime Video');
      expect(result.rent).toHaveLength(1);
      expect(result.rent?.[0]?.providerName).toBe('Apple TV+');

      // 2. Segunda chamada (cache hit) - não deve chamar o tmdbClient novamente
      const cachedResult = await service.getMovieProviders(550, 'BR');
      expect(mockTmdbClient.getWatchProviders).toHaveBeenCalledTimes(1);
      expect(cachedResult).toEqual(result);
    });

    it('deve lançar TmdbApiError(400) se o movieId for inválido', async () => {
      const service = new WatchProvidersService();
      await expect(service.getMovieProviders(0)).rejects.toThrow(TmdbApiError);
      await expect(service.getMovieProviders(-5)).rejects.toThrow('Invalid movieId');
      await expect(service.getMovieProviders(12.5)).rejects.toThrow('Invalid movieId');
    });

    it('deve fornecer método getNormalizedFlatrate retornando diretamente os provedores por assinatura', async () => {
      const mockTmdbResponse: TmdbWatchProvidersResponse = {
        id: 100,
        results: {
          BR: {
            flatrate: [
              {
                provider_id: 307,
                provider_name: 'Globoplay',
                logo_path: '/globo.jpg',
              },
            ],
          },
        },
      };

      const mockTmdbClient = {
        getWatchProviders: vi.fn().mockResolvedValue(mockTmdbResponse),
      } as unknown as TmdbClient;

      const service = new WatchProvidersService({
        tmdbClient: mockTmdbClient,
        cacheService: new MemoryCacheService(),
      });

      const flatrate = await service.getNormalizedFlatrate(100);
      expect(flatrate).toHaveLength(1);
      expect(flatrate[0]?.providerName).toBe('Globoplay');
      expect(flatrate[0]?.brandColor).toBe('#E31C23');
    });
  });
});
