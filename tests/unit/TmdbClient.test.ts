import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCacheService } from '../../src/infrastructure/cache/MemoryCacheService.js';
import { TmdbClient } from '../../src/infrastructure/tmdb/TmdbClient.js';
import {
  TmdbApiError,
  TmdbConfigurationError,
  TmdbMovieDetailsResponse,
  TmdbMovieResult,
  TmdbPaginatedResponse,
  TmdbRateLimitError,
} from '../../src/infrastructure/tmdb/types.js';

describe('MemoryCacheService', () => {
  it('deve armazenar e recuperar valores com sucesso', async () => {
    const cache = new MemoryCacheService();
    await cache.set('chave-teste', { nome: 'Matrix' });

    const valor = await cache.get<{ nome: string }>('chave-teste');
    expect(valor).toEqual({ nome: 'Matrix' });
    expect(await cache.has('chave-teste')).toBe(true);
  });

  it('deve retornar null para chaves inexistentes', async () => {
    const cache = new MemoryCacheService();
    expect(await cache.get('chave-inexistente')).toBeNull();
    expect(await cache.has('chave-inexistente')).toBe(false);
  });

  it('deve expirar valores apos o TTL configurado', async () => {
    const cache = new MemoryCacheService({ defaultTtlSeconds: 1 });
    vi.useFakeTimers();

    await cache.set('expiravel', 'dado', 1);
    expect(await cache.get('expiravel')).toBe('dado');

    vi.advanceTimersByTime(1100);

    expect(await cache.get('expiravel')).toBeNull();
    expect(await cache.has('expiravel')).toBe(false);

    vi.useRealTimers();
  });

  it('deve remover chaves com delete e limpar tudo com clear', async () => {
    const cache = new MemoryCacheService();
    await cache.set('item1', 'a');
    await cache.set('item2', 'b');

    expect(cache.size()).toBe(2);
    expect(await cache.delete('item1')).toBe(true);
    expect(await cache.get('item1')).toBeNull();
    expect(cache.size()).toBe(1);

    await cache.clear();
    expect(cache.size()).toBe(0);
  });
});

describe('TmdbClient', () => {
  const originalEnv = process.env.TMDB_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.TMDB_API_KEY;
  });

  afterEach(() => {
    process.env.TMDB_API_KEY = originalEnv;
  });

  it('deve lancar TmdbConfigurationError se nenhuma chave de API for informada', async () => {
    const client = new TmdbClient();
    await expect(client.getPopularMovies()).rejects.toThrow(TmdbConfigurationError);
  });

  it('deve utilizar process.env.TMDB_API_KEY caso nao seja passada chave no config', async () => {
    process.env.TMDB_API_KEY = 'chave-ambiente-123';

    const mockResponse: TmdbPaginatedResponse<TmdbMovieResult> = {
      page: 1,
      results: [
        {
          id: 101,
          title: 'Filme Ambiente',
          release_date: '2023-01-01',
          genre_ids: [28],
        },
      ],
      total_pages: 1,
      total_results: 1,
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const client = new TmdbClient();
    const result = await client.getPopularMovies(1);

    expect(result.movies).toHaveLength(1);
    expect(result.movies[0]?.title).toBe('Filme Ambiente');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const urlChamada = fetchSpy.mock.calls[0]?.[0] as string;
    expect(urlChamada).toContain('api_key=chave-ambiente-123');
  });

  it('deve buscar filmes populares e utilizar cache na segunda chamada', async () => {
    const mockResponse: TmdbPaginatedResponse<TmdbMovieResult> = {
      page: 1,
      results: [
        {
          id: 500,
          title: 'Oppenheimer',
          overview: 'A historia de J. Robert Oppenheimer.',
          release_date: '2023-07-19',
          genre_ids: [18, 36],
          vote_average: 8.1,
        },
      ],
      total_pages: 5,
      total_results: 100,
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const cache = new MemoryCacheService();
    const client = new TmdbClient({
      apiKey: 'test-api-key',
      cacheService: cache,
    });

    const primeiraChamada = await client.getPopularMovies(1);
    expect(primeiraChamada.movies).toHaveLength(1);
    expect(primeiraChamada.movies[0]?.title).toBe('Oppenheimer');
    expect(primeiraChamada.page).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const segundaChamada = await client.getPopularMovies(1);
    expect(segundaChamada.movies).toHaveLength(1);
    expect(segundaChamada.movies[0]?.title).toBe('Oppenheimer');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('deve buscar filmes por query textual e nao chamar fetch para query vazia', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const client = new TmdbClient({ apiKey: 'test-api-key' });
    const vazia = await client.searchMovies('   ');

    expect(vazia.movies).toEqual([]);
    expect(vazia.totalResults).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    const mockResponse: TmdbPaginatedResponse<TmdbMovieResult> = {
      page: 1,
      results: [
        {
          id: 603,
          title: 'The Matrix',
          release_date: '1999-03-30',
          genre_ids: [28, 878],
        },
      ],
      total_pages: 1,
      total_results: 1,
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const buscaValida = await client.searchMovies('Matrix', 1);
    expect(buscaValida.movies).toHaveLength(1);
    expect(buscaValida.movies[0]?.title).toBe('The Matrix');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const buscaCache = await client.searchMovies('matrix', 1);
    expect(buscaCache.movies).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('deve buscar detalhes do filme incluindo watch providers e cachear resultado', async () => {
    const mockDetails: TmdbMovieDetailsResponse = {
      id: 550,
      title: 'Clube da Luta',
      original_title: 'Fight Club',
      overview: 'Um homem deprimido que sofre de insonia.',
      release_date: '1999-10-15',
      runtime: 139,
      vote_average: 8.4,
      genres: [{ id: 18, name: 'Drama' }],
      'watch/providers': {
        results: {
          BR: {
            flatrate: [
              {
                provider_id: 119,
                provider_name: 'Amazon Prime Video',
                logo_path: '/logo.jpg',
              },
            ],
          },
        },
      },
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDetails,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const client = new TmdbClient({ apiKey: 'test-api-key' });
    const filme = await client.getMovieDetails(550);

    expect(filme.tmdbId).toBe(550);
    expect(filme.title).toBe('Clube da Luta');
    expect(filme.runtimeMinutes).toBe(139);
    expect(filme.streamingProviders).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const filmeCache = await client.getMovieDetails(550);
    expect(filmeCache.tmdbId).toBe(550);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('deve lancar erro para movieId invalido em getMovieDetails', async () => {
    const client = new TmdbClient({ apiKey: 'test-api-key' });
    await expect(client.getMovieDetails(0)).rejects.toThrow(TmdbApiError);
    await expect(client.getMovieDetails(-5)).rejects.toThrow(TmdbApiError);
  });

  it('deve tratar status 429 de Rate Limit lancando TmdbRateLimitError com retryAfter', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({
        'retry-after': '12',
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const client = new TmdbClient({ apiKey: 'test-api-key' });

    try {
      await client.getPopularMovies(1);
      expect.fail('Deveria ter lancado TmdbRateLimitError');
    } catch (error) {
      expect(error).toBeInstanceOf(TmdbRateLimitError);
      const rateLimitError = error as TmdbRateLimitError;
      expect(rateLimitError.statusCode).toBe(429);
      expect(rateLimitError.retryAfterSeconds).toBe(12);
    }
  });

  it('deve tratar erros de status de API 500 lancando TmdbApiError', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      json: async () => ({ status_message: 'Server failure' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const client = new TmdbClient({ apiKey: 'test-api-key' });

    await expect(client.getPopularMovies(1)).rejects.toThrow(TmdbApiError);
  });

  it('deve tratar falha de rede da requisicao fetch lancando TmdbApiError', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', fetchSpy);

    const client = new TmdbClient({ apiKey: 'test-api-key' });

    await expect(client.getPopularMovies(1)).rejects.toThrow(TmdbApiError);
  });
});
