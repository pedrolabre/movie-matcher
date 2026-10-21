import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/server.js';
import { CatalogService } from '../../src/core/services/CatalogService.js';
import { MovieWatchProvidersResult } from '../../src/core/domain/types/schemas.js';
import { TmdbApiError } from '../../src/infrastructure/tmdb/types.js';

describe('Streaming Providers Routes Integration (/api/movies/:id/providers)', () => {
  let app: FastifyInstance;
  let catalogService: CatalogService;

  const sampleProvidersResult: MovieWatchProvidersResult = {
    movieId: 550,
    region: 'BR',
    providers: [
      {
        providerId: 8,
        providerName: 'Netflix',
        slug: 'netflix',
        brandColor: '#E50914',
        logoPath: 'https://image.tmdb.org/t/p/w500/netflix.jpg',
        displayPriority: 1,
      },
      {
        providerId: 119,
        providerName: 'Prime Video',
        slug: 'prime-video',
        brandColor: '#00A8E1',
        logoPath: 'https://image.tmdb.org/t/p/w500/prime.jpg',
        displayPriority: 2,
      },
    ],
    flatrate: [
      {
        providerId: 8,
        providerName: 'Netflix',
        slug: 'netflix',
        brandColor: '#E50914',
        logoPath: 'https://image.tmdb.org/t/p/w500/netflix.jpg',
        displayPriority: 1,
      },
      {
        providerId: 119,
        providerName: 'Prime Video',
        slug: 'prime-video',
        brandColor: '#00A8E1',
        logoPath: 'https://image.tmdb.org/t/p/w500/prime.jpg',
        displayPriority: 2,
      },
    ],
    rent: [
      {
        providerId: 350,
        providerName: 'Apple TV+',
        slug: 'apple-tv-plus',
        brandColor: '#000000',
        logoPath: 'https://image.tmdb.org/t/p/w500/apple.jpg',
        displayPriority: 5,
      },
    ],
    buy: [],
    link: 'https://www.themoviedb.org/movie/550/watch?locale=pt-BR',
  };

  beforeEach(async () => {
    catalogService = new CatalogService();
    app = buildApp({ catalogService });
    await app.ready();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('deve retornar status 200 e lista estruturada de provedores para a região padrão (BR)', async () => {
    vi.spyOn(catalogService, 'getMovieProviders').mockResolvedValue(sampleProvidersResult);

    const response = await app.inject({
      method: 'GET',
      url: '/api/movies/550/providers',
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.movieId).toBe(550);
    expect(payload.region).toBe('BR');
    expect(payload.flatrate).toHaveLength(2);
    expect(payload.flatrate[0].providerName).toBe('Netflix');
    expect(payload.flatrate[1].providerName).toBe('Prime Video');
    expect(payload.link).toContain('https://www.themoviedb.org/movie/550/watch');
  });

  it('deve aceitar query param region customizado', async () => {
    const usResult: MovieWatchProvidersResult = {
      ...sampleProvidersResult,
      region: 'US',
    };
    const spy = vi.spyOn(catalogService, 'getMovieProviders').mockResolvedValue(usResult);

    const response = await app.inject({
      method: 'GET',
      url: '/api/movies/550/providers?region=US',
    });

    expect(response.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledWith(550, 'US');
    const payload = response.json();
    expect(payload.region).toBe('US');
  });

  it('deve retornar 400 se o id do filme for inválido ou não numérico', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/movies/invalido/providers',
    });

    expect(response.statusCode).toBe(400);
    const payload = response.json();
    expect(payload.error).toBe('Bad Request');
  });

  it('deve retornar 400 se o id do filme for zero ou negativo', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/movies/-10/providers',
    });

    expect(response.statusCode).toBe(400);
    const payload = response.json();
    expect(payload.error).toBe('Bad Request');
  });

  it('deve retornar 404 se a API do TMDB indicar filme inexistente', async () => {
    vi.spyOn(catalogService, 'getMovieProviders').mockRejectedValue(
      new TmdbApiError(404, 'The resource you requested could not be found.'),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/movies/99999999/providers',
    });

    expect(response.statusCode).toBe(404);
    const payload = response.json();
    expect(payload.error).toBe('Not Found');
  });
});
