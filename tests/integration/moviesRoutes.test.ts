import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/server.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';
import { CatalogService } from '../../src/core/services/CatalogService.js';
import { TmdbApiError, TmdbRateLimitError } from '../../src/infrastructure/tmdb/types.js';

describe('Movies Routes Integration (/api/movies)', () => {
  let app: FastifyInstance;
  let catalogServiceMock: CatalogService;

  const sampleMovie: Movie = {
    tmdbId: 550,
    title: 'Clube da Luta',
    originalTitle: 'Fight Club',
    overview: 'Um homem deprimido que sofre de insônia conhece um vendedor estranho.',
    posterPath: 'https://image.tmdb.org/t/p/w500/fight_club.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/fight_club_bg.jpg',
    releaseYear: 1999,
    runtimeMinutes: 139,
    voteAverage: 8.4,
    genres: [
      { id: 18, name: 'Drama' },
      { id: 53, name: 'Thriller' },
    ],
    streamingProviders: [
      { providerId: 119, providerName: 'Amazon Prime Video', logoPath: null },
    ],
    syncedAt: new Date('2026-10-30T10:00:00.000Z'),
  };

  beforeEach(async () => {
    catalogServiceMock = new CatalogService();
    app = buildApp({ catalogService: catalogServiceMock });
    await app.ready();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  describe('GET /api/movies/trending', () => {
    it('deve retornar status 200 e filmes paginados na pagina default (1)', async () => {
      vi.spyOn(catalogServiceMock, 'getTrending').mockResolvedValue({
        movies: [sampleMovie],
        page: 1,
        totalPages: 20,
        totalResults: 400,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/trending',
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.movies).toHaveLength(1);
      expect(payload.movies[0].title).toBe('Clube da Luta');
      expect(payload.page).toBe(1);
      expect(payload.totalPages).toBe(20);
      expect(payload.totalResults).toBe(400);
    });

    it('deve retornar status 200 respeitando parametro page informado na query', async () => {
      const getTrendingSpy = vi.spyOn(catalogServiceMock, 'getTrending').mockResolvedValue({
        movies: [sampleMovie],
        page: 3,
        totalPages: 20,
        totalResults: 400,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/trending?page=3',
      });

      expect(response.statusCode).toBe(200);
      expect(getTrendingSpy).toHaveBeenCalledWith(3);
      const payload = response.json();
      expect(payload.page).toBe(3);
    });

    it('deve retornar status 400 quando parametro page for invalido', async () => {
      const responses = await Promise.all([
        app.inject({ method: 'GET', url: '/api/movies/trending?page=0' }),
        app.inject({ method: 'GET', url: '/api/movies/trending?page=-2' }),
        app.inject({ method: 'GET', url: '/api/movies/trending?page=abc' }),
      ]);

      for (const res of responses) {
        expect(res.statusCode).toBe(400);
        const payload = res.json();
        expect(payload.statusCode).toBe(400);
        expect(payload.error).toBe('Bad Request');
        expect(payload.issues).toBeDefined();
      }
    });
  });

  describe('GET /api/movies/search', () => {
    it('deve retornar status 200 e filmes encontrados para busca textual valida', async () => {
      const searchSpy = vi.spyOn(catalogServiceMock, 'searchMovies').mockResolvedValue({
        movies: [sampleMovie],
        page: 1,
        totalPages: 1,
        totalResults: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/search?query=Fight%20Club',
      });

      expect(response.statusCode).toBe(200);
      expect(searchSpy).toHaveBeenCalledWith('Fight Club', 1);
      const payload = response.json();
      expect(payload.movies).toHaveLength(1);
      expect(payload.movies[0].tmdbId).toBe(550);
    });

    it('deve retornar status 200 com query e page validos', async () => {
      const searchSpy = vi.spyOn(catalogServiceMock, 'searchMovies').mockResolvedValue({
        movies: [sampleMovie],
        page: 2,
        totalPages: 5,
        totalResults: 50,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/search?query=Matrix&page=2',
      });

      expect(response.statusCode).toBe(200);
      expect(searchSpy).toHaveBeenCalledWith('Matrix', 2);
      const payload = response.json();
      expect(payload.page).toBe(2);
    });

    it('deve retornar status 400 quando query estiver ausente', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/search',
      });

      expect(response.statusCode).toBe(400);
      const payload = response.json();
      expect(payload.statusCode).toBe(400);
      expect(payload.error).toBe('Bad Request');
    });

    it('deve retornar status 400 quando query for vazia ou apenas espacos', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/search?query=%20%20%20',
      });

      expect(response.statusCode).toBe(400);
      const payload = response.json();
      expect(payload.statusCode).toBe(400);
      expect(payload.message).toContain('Busca não pode ser vazia');
    });

    it('deve retornar status 400 quando page for invalido na busca', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/search?query=Matrix&page=-1',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/movies/genres', () => {
    it('deve retornar status 200 e a lista de generos cadastrados', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/genres',
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.genres).toBeInstanceOf(Array);
      expect(payload.genres.length).toBeGreaterThan(0);
      expect(payload.genres[0]).toHaveProperty('id');
      expect(payload.genres[0]).toHaveProperty('name');
    });
  });

  describe('GET /api/movies/:id', () => {
    it('deve retornar status 200 e metadados detalhados de filme existente', async () => {
      vi.spyOn(catalogServiceMock, 'getMovieDetails').mockResolvedValue(sampleMovie);

      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/550',
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.tmdbId).toBe(550);
      expect(payload.title).toBe('Clube da Luta');
      expect(payload.releaseYear).toBe(1999);
      expect(payload.genres).toHaveLength(2);
      expect(payload.streamingProviders).toHaveLength(1);
    });

    it('deve retornar status 404 quando o filme nao for encontrado via TmdbApiError', async () => {
      vi.spyOn(catalogServiceMock, 'getMovieDetails').mockRejectedValue(
        new TmdbApiError(404, 'The resource you requested could not be found.'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/9999999',
      });

      expect(response.statusCode).toBe(404);
      const payload = response.json();
      expect(payload.statusCode).toBe(404);
      expect(payload.error).toBe('Not Found');
      expect(payload.message).toBe('Movie not found');
    });

    it('deve retornar status 400 quando o id do filme for invalido', async () => {
      const responses = await Promise.all([
        app.inject({ method: 'GET', url: '/api/movies/abc' }),
        app.inject({ method: 'GET', url: '/api/movies/0' }),
        app.inject({ method: 'GET', url: '/api/movies/-550' }),
      ]);

      for (const res of responses) {
        expect(res.statusCode).toBe(400);
        const payload = res.json();
        expect(payload.statusCode).toBe(400);
        expect(payload.error).toBe('Bad Request');
      }
    });
  });

  describe('Tratamento de Rate Limit e Falhas da API TMDB', () => {
    it('deve retornar status 429 e cabecalho Retry-After sob rate limit do TMDB', async () => {
      vi.spyOn(catalogServiceMock, 'getTrending').mockRejectedValue(
        new TmdbRateLimitError('Rate limit exceeded', 12),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/trending',
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['retry-after']).toBe('12');
      const payload = response.json();
      expect(payload.statusCode).toBe(429);
      expect(payload.error).toBe('Too Many Requests');
      expect(payload.message).toBe('Rate limit exceeded');
    });

    it('deve retornar status 500 para erros genericos nao mapeados', async () => {
      vi.spyOn(catalogServiceMock, 'getTrending').mockRejectedValue(
        new Error('Falha inesperada no cluster'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/movies/trending',
      });

      expect(response.statusCode).toBe(500);
      const payload = response.json();
      expect(payload.statusCode).toBe(500);
      expect(payload.error).toBe('Internal Server Error');
    });

    it('deve instanciar app default funcional quando nao passadas options no buildApp', async () => {
      const defaultApp = buildApp();
      await defaultApp.ready();

      const response = await defaultApp.inject({
        method: 'GET',
        url: '/api/movies/genres',
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.genres.length).toBeGreaterThan(0);

      await defaultApp.close();
    });
  });
});
