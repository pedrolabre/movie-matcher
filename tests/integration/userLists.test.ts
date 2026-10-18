import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/api/server.js';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { PreferenceService } from '../../src/core/services/PreferenceService.js';
import { InMemoryPreferenceRepository } from '../../src/infrastructure/database/repositories/PreferenceRepository.js';

describe('User Lists & Enriched Preferences Integration Tests', () => {
  const userId = '12345678-1234-1234-1234-1234567890ab';
  let repository: InMemoryPreferenceRepository;
  let preferenceService: PreferenceService;
  let app: ReturnType<typeof buildApp>;

  const mockCatalogService = {
    getMovieDetails: async (movieId: number) => {
      const titles: Record<number, { title: string; genreId: number; genreName: string }> = {
        100: { title: 'Duna', genreId: 878, genreName: 'Ficção Científica' },
        200: { title: 'Interestelar', genreId: 878, genreName: 'Ficção Científica' },
        300: { title: 'Pulp Fiction', genreId: 80, genreName: 'Crime' },
        400: { title: 'Clube da Luta', genreId: 18, genreName: 'Drama' },
        500: { title: 'O Poderoso Chefão', genreId: 80, genreName: 'Crime' },
      };

      const info = titles[movieId] ?? {
        title: `Filme #${movieId}`,
        genreId: 28,
        genreName: 'Ação',
      };

      return {
        tmdbId: movieId,
        title: info.title,
        originalTitle: info.title,
        overview: `Sinopse de ${info.title}`,
        posterPath: `/poster-${movieId}.jpg`,
        backdropPath: `/backdrop-${movieId}.jpg`,
        releaseYear: 2024,
        runtimeMinutes: 120,
        voteAverage: 8.5,
        genres: [{ id: info.genreId, name: info.genreName }],
        streamingProviders: [],
        syncedAt: new Date(),
      };
    },
  } as any;

  beforeEach(() => {
    repository = new InMemoryPreferenceRepository();
    preferenceService = new PreferenceService(repository, mockCatalogService);
    app = buildApp({ preferenceService });
  });

  describe('GET /api/users/me/watchlist', () => {
    it('deve retornar 401 Unauthorized se header x-user-id nao for enviado', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me/watchlist',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('deve retornar lista paginada vazia se o usuario nao tiver filmes salvos', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me/watchlist',
        headers: {
          'x-user-id': userId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(0);
      expect(body.totalResults).toBe(0);
      expect(body.page).toBe(1);
    });

    it('deve retornar filmes da watchlist com metadados enriquecidos', async () => {
      await preferenceService.recordPreference(userId, 100, PreferenceStatus.WANT_TO_WATCH);
      await preferenceService.recordPreference(userId, 200, PreferenceStatus.WANT_TO_WATCH);
      await preferenceService.recordPreference(userId, 300, PreferenceStatus.SKIPPED);

      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me/watchlist',
        headers: {
          'x-user-id': userId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.totalResults).toBe(2);
      expect(body.items).toHaveLength(2);

      const titles = body.items.map((i: any) => i.movie.title);
      expect(titles).toContain('Duna');
      expect(titles).toContain('Interestelar');
      // Garante que SKIPPED não vaza
      expect(titles).not.toContain('Pulp Fiction');
    });

    it('deve filtrar watchlist por busca textual e genero', async () => {
      await preferenceService.recordPreference(userId, 100, PreferenceStatus.WANT_TO_WATCH);
      await preferenceService.recordPreference(userId, 200, PreferenceStatus.WANT_TO_WATCH);
      await preferenceService.recordPreference(userId, 400, PreferenceStatus.WANT_TO_WATCH);

      // Busca por 'inte'
      const searchRes = await app.inject({
        method: 'GET',
        url: '/api/users/me/watchlist?search=inte',
        headers: { 'x-user-id': userId },
      });
      expect(searchRes.statusCode).toBe(200);
      const searchBody = JSON.parse(searchRes.body);
      expect(searchBody.totalResults).toBe(1);
      expect(searchBody.items[0].movie.title).toBe('Interestelar');

      // Filtro por gênero Ficção Científica (878)
      const genreRes = await app.inject({
        method: 'GET',
        url: '/api/users/me/watchlist?genreId=878',
        headers: { 'x-user-id': userId },
      });
      expect(genreRes.statusCode).toBe(200);
      const genreBody = JSON.parse(genreRes.body);
      expect(genreBody.totalResults).toBe(2);
    });
  });

  describe('GET /api/users/me/history', () => {
    it('deve retornar 401 se nao autenticado', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me/history',
      });
      expect(response.statusCode).toBe(401);
    });

    it('deve retornar apenas filmes marcados como ALREADY_WATCHED', async () => {
      await preferenceService.recordPreference(userId, 300, PreferenceStatus.ALREADY_WATCHED);
      await preferenceService.recordPreference(userId, 500, PreferenceStatus.ALREADY_WATCHED);
      await preferenceService.recordPreference(userId, 100, PreferenceStatus.WANT_TO_WATCH);

      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me/history',
        headers: { 'x-user-id': userId },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.totalResults).toBe(2);
      expect(body.items.every((i: any) => i.preference.status === PreferenceStatus.ALREADY_WATCHED)).toBe(true);
    });
  });

  describe('DELETE /api/users/me/preferences/:movieId e transicoes de status', () => {
    it('deve remover um filme da watchlist e refletir na consulta seguinte', async () => {
      await preferenceService.recordPreference(userId, 100, PreferenceStatus.WANT_TO_WATCH);

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: '/api/users/me/preferences/100',
        headers: { 'x-user-id': userId },
      });

      expect(deleteRes.statusCode).toBe(200);
      const deleteBody = JSON.parse(deleteRes.body);
      expect(deleteBody.success).toBe(true);
      expect(deleteBody.removed).toBe(true);

      const checkRes = await app.inject({
        method: 'GET',
        url: '/api/users/me/watchlist',
        headers: { 'x-user-id': userId },
      });
      const checkBody = JSON.parse(checkRes.body);
      expect(checkBody.totalResults).toBe(0);
    });

    it('deve mover filme de watchlist para historico atomicamente via POST /api/preferences', async () => {
      // 1. Salva na watchlist
      await app.inject({
        method: 'POST',
        url: '/api/preferences',
        headers: { 'x-user-id': userId },
        payload: { movieId: 200, status: PreferenceStatus.WANT_TO_WATCH },
      });

      // 2. Confirma na watchlist
      const watchlistRes1 = await app.inject({
        method: 'GET',
        url: '/api/users/me/watchlist',
        headers: { 'x-user-id': userId },
      });
      expect(JSON.parse(watchlistRes1.body).totalResults).toBe(1);

      // 3. Move para o histórico
      await app.inject({
        method: 'POST',
        url: '/api/preferences',
        headers: { 'x-user-id': userId },
        payload: { movieId: 200, status: PreferenceStatus.ALREADY_WATCHED },
      });

      // 4. Confirma que saiu da watchlist e entrou no histórico
      const watchlistRes2 = await app.inject({
        method: 'GET',
        url: '/api/users/me/watchlist',
        headers: { 'x-user-id': userId },
      });
      expect(JSON.parse(watchlistRes2.body).totalResults).toBe(0);

      const historyRes = await app.inject({
        method: 'GET',
        url: '/api/users/me/history',
        headers: { 'x-user-id': userId },
      });
      const historyBody = JSON.parse(historyRes.body);
      expect(historyBody.totalResults).toBe(1);
      expect(historyBody.items[0].movie.title).toBe('Interestelar');
    });

    it('deve suportar endpoints equivalentes sob o prefixo /api/preferences/me/watchlist e /api/preferences/me/history', async () => {
      await preferenceService.recordPreference(userId, 100, PreferenceStatus.WANT_TO_WATCH);

      const res = await app.inject({
        method: 'GET',
        url: '/api/preferences/me/watchlist',
        headers: { 'x-user-id': userId },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).totalResults).toBe(1);

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: '/api/preferences/100',
        headers: { 'x-user-id': userId },
      });
      expect(deleteRes.statusCode).toBe(200);
      expect(JSON.parse(deleteRes.body).removed).toBe(true);
    });
  });
});
