import { describe, expect, it } from 'vitest';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { PreferenceService } from '../../src/core/services/PreferenceService.js';
import { InMemoryPreferenceRepository } from '../../src/infrastructure/database/repositories/PreferenceRepository.js';

describe('PreferenceService Unit Tests', () => {
  const user1 = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const user2 = '11111111-2222-3333-4444-555555555555';
  const user3 = '66666666-7777-8888-9999-000000000000';
  const movieId = 157336;

  it('deve registrar uma nova preferencia com isNew true e gerar identificador unico', async () => {
    const repository = new InMemoryPreferenceRepository();
    const service = new PreferenceService(repository);

    const result = await service.recordPreference(
      user1,
      movieId,
      PreferenceStatus.WANT_TO_WATCH,
    );

    expect(result.isNew).toBe(true);
    expect(result.preference.id).toBeDefined();
    expect(result.preference.userId).toBe(user1);
    expect(result.preference.movieId).toBe(movieId);
    expect(result.preference.status).toBe(PreferenceStatus.WANT_TO_WATCH);
    expect(result.preference.createdAt).toBeInstanceOf(Date);
    expect(result.preference.updatedAt).toBeInstanceOf(Date);
  });

  it('deve atualizar uma preferencia existente via upsert idempotente mantendo o id e createdAt originais', async () => {
    const repository = new InMemoryPreferenceRepository();
    const service = new PreferenceService(repository);

    const firstResult = await service.recordPreference(
      user1,
      movieId,
      PreferenceStatus.WANT_TO_WATCH,
    );

    const updateResult = await service.recordPreference(
      user1,
      movieId,
      PreferenceStatus.ALREADY_WATCHED,
    );

    expect(updateResult.isNew).toBe(false);
    expect(updateResult.preference.id).toBe(firstResult.preference.id);
    expect(updateResult.preference.createdAt.getTime()).toBe(
      firstResult.preference.createdAt.getTime(),
    );
    expect(updateResult.preference.status).toBe(PreferenceStatus.ALREADY_WATCHED);
    expect(updateResult.preference.updatedAt.getTime()).toBeGreaterThanOrEqual(
      firstResult.preference.updatedAt.getTime(),
    );
  });

  it('deve ser idempotente em chamadas repetidas com o mesmo status sem duplicar registros', async () => {
    const repository = new InMemoryPreferenceRepository();
    const service = new PreferenceService(repository);

    await service.recordPreference(user1, movieId, PreferenceStatus.WANT_TO_WATCH);
    await service.recordPreference(user1, movieId, PreferenceStatus.WANT_TO_WATCH);
    const thirdResult = await service.recordPreference(
      user1,
      movieId,
      PreferenceStatus.WANT_TO_WATCH,
    );

    expect(thirdResult.isNew).toBe(false);
    const userPrefs = await service.getUserPreferences(user1);
    expect(userPrefs).toHaveLength(1);
  });

  it('deve manter registros independentes para combinacoes distintas de usuario e filme', async () => {
    const repository = new InMemoryPreferenceRepository();
    const service = new PreferenceService(repository);

    await service.recordPreference(user1, 101, PreferenceStatus.WANT_TO_WATCH);
    await service.recordPreference(user1, 102, PreferenceStatus.SKIPPED);
    await service.recordPreference(user2, 101, PreferenceStatus.ALREADY_WATCHED);

    const user1Prefs = await service.getUserPreferences(user1);
    const user2Prefs = await service.getUserPreferences(user2);

    expect(user1Prefs).toHaveLength(2);
    expect(user2Prefs).toHaveLength(1);
  });

  it('deve retornar apenas itens com status WANT_TO_WATCH ao consultar a watchlist do usuario', async () => {
    const repository = new InMemoryPreferenceRepository();
    const service = new PreferenceService(repository);

    await service.recordPreference(user1, 201, PreferenceStatus.WANT_TO_WATCH);
    await service.recordPreference(user1, 202, PreferenceStatus.SKIPPED);
    await service.recordPreference(user1, 203, PreferenceStatus.ALREADY_WATCHED);
    await service.recordPreference(user1, 204, PreferenceStatus.WANT_TO_WATCH);

    const watchlist = await service.getUserWatchlist(user1);

    expect(watchlist).toHaveLength(2);
    expect(watchlist.every((p) => p.status === PreferenceStatus.WANT_TO_WATCH)).toBe(true);
    expect(watchlist.map((p) => p.movieId)).toEqual(expect.arrayContaining([201, 204]));
  });

  it('deve retornar apenas itens com status ALREADY_WATCHED ao consultar o historico do usuario', async () => {
    const repository = new InMemoryPreferenceRepository();
    const service = new PreferenceService(repository);

    await service.recordPreference(user1, 301, PreferenceStatus.WANT_TO_WATCH);
    await service.recordPreference(user1, 302, PreferenceStatus.ALREADY_WATCHED);
    await service.recordPreference(user1, 303, PreferenceStatus.ALREADY_WATCHED);

    const history = await service.getUserHistory(user1);

    expect(history).toHaveLength(2);
    expect(history.every((p) => p.status === PreferenceStatus.ALREADY_WATCHED)).toBe(true);
    expect(history.map((p) => p.movieId)).toEqual(expect.arrayContaining([302, 303]));
  });

  it('deve garantir isolamento absoluto de rejeicoes SKIPPED ao consultar candidatos consensuais para grupos', async () => {
    const repository = new InMemoryPreferenceRepository();
    const service = new PreferenceService(repository);
    const targetMovie = 550;

    await service.recordPreference(user1, targetMovie, PreferenceStatus.WANT_TO_WATCH);
    await service.recordPreference(user2, targetMovie, PreferenceStatus.SKIPPED);
    await service.recordPreference(user3, targetMovie, PreferenceStatus.WANT_TO_WATCH);

    const consensualCandidates = await service.getConsensualCandidates(
      [user1, user2, user3],
      targetMovie,
    );

    expect(consensualCandidates).toHaveLength(2);
    expect(consensualCandidates.map((c) => c.userId)).toEqual([user1, user3]);
    expect(consensualCandidates.some((c) => c.userId === user2)).toBe(false);

    const positiveCount = await service.countPositivePreferences(targetMovie, [
      user1,
      user2,
      user3,
    ]);
    expect(positiveCount).toBe(2);
  });

  it('deve converter preferencias para DTO seguro de grupo e sanitizar rejeicoes e historico como nulos', () => {
    const service = new PreferenceService();
    const now = new Date();

    const safeDto = service.sanitizeForGroup({
      id: 'pref-1',
      userId: user1,
      movieId: 10,
      status: PreferenceStatus.WANT_TO_WATCH,
      createdAt: now,
      updatedAt: now,
    });

    const skippedDto = service.sanitizeForGroup({
      id: 'pref-2',
      userId: user2,
      movieId: 10,
      status: PreferenceStatus.SKIPPED,
      createdAt: now,
      updatedAt: now,
    });

    const watchedDto = service.sanitizeForGroup({
      id: 'pref-3',
      userId: user3,
      movieId: 10,
      status: PreferenceStatus.ALREADY_WATCHED,
      createdAt: now,
      updatedAt: now,
    });

    expect(safeDto).toEqual({
      userId: user1,
      movieId: 10,
      status: PreferenceStatus.WANT_TO_WATCH,
      votedAt: now,
    });
    expect(skippedDto).toBeNull();
    expect(watchedDto).toBeNull();
  });

  it('deve consultar preferencia especifica de um usuario para determinado filme', async () => {
    const repository = new InMemoryPreferenceRepository();
    const service = new PreferenceService(repository);

    await service.recordPreference(user1, 777, PreferenceStatus.WANT_TO_WATCH);

    const found = await service.getUserPreferenceForMovie(user1, 777);
    const notFound = await service.getUserPreferenceForMovie(user1, 999);

    expect(found).not.toBeNull();
    expect(found?.movieId).toBe(777);
    expect(notFound).toBeNull();
  });

  it('deve remover uma preferencia existente retornando true e false para item inexistente', async () => {
    const repository = new InMemoryPreferenceRepository();
    const service = new PreferenceService(repository);

    await service.recordPreference(user1, 888, PreferenceStatus.WANT_TO_WATCH);

    const removed = await service.removePreference(user1, 888);
    expect(removed).toBe(true);

    const check = await service.getUserPreferenceForMovie(user1, 888);
    expect(check).toBeNull();

    const removedAgain = await service.removePreference(user1, 888);
    expect(removedAgain).toBe(false);
  });

  it('deve enriquecer preferencias com metadados do catalogo e suportar busca e filtros de genero', async () => {
    const repository = new InMemoryPreferenceRepository();
    const mockCatalogService = {
      getMovieDetails: async (id: number) => ({
        tmdbId: id,
        title: id === 10 ? 'Interestelar' : id === 20 ? 'Duna: Parte 2' : 'O Poderoso Chefão',
        originalTitle: 'Movie',
        overview: 'Overview',
        posterPath: `/poster-${id}.jpg`,
        backdropPath: `/backdrop-${id}.jpg`,
        releaseYear: 2024,
        runtimeMinutes: 150,
        voteAverage: 8.9,
        genres: id === 10 ? [{ id: 878, name: 'Ficção Científica' }] : [{ id: 18, name: 'Drama' }],
        streamingProviders: [],
        syncedAt: new Date(),
      }),
    } as any;

    const service = new PreferenceService(repository, mockCatalogService);

    await service.recordPreference(user1, 10, PreferenceStatus.WANT_TO_WATCH);
    await service.recordPreference(user1, 20, PreferenceStatus.WANT_TO_WATCH);
    await service.recordPreference(user1, 30, PreferenceStatus.WANT_TO_WATCH);
    await service.recordPreference(user1, 40, PreferenceStatus.SKIPPED);

    const allWatchlist = await service.getUserEnrichedWatchlist(user1);
    expect(allWatchlist.totalResults).toBe(3);
    expect(allWatchlist.items).toHaveLength(3);
    // Garante que SKIPPED não foi incluído
    expect(allWatchlist.items.some((i) => i.preference.movieId === 40)).toBe(false);

    // Filtro por busca textual
    const searched = await service.getUserEnrichedWatchlist(user1, { search: 'duna' });
    expect(searched.totalResults).toBe(1);
    expect(searched.items[0]?.movie.title).toBe('Duna: Parte 2');

    // Filtro por gênero (Ficção Científica = 878)
    const genreFiltered = await service.getUserEnrichedWatchlist(user1, { genreId: 878 });
    expect(genreFiltered.totalResults).toBe(1);
    expect(genreFiltered.items[0]?.movie.title).toBe('Interestelar');

    // Paginação com limite de 2
    const paginated = await service.getUserEnrichedWatchlist(user1, { page: 1, limit: 2 });
    expect(paginated.items).toHaveLength(2);
    expect(paginated.page).toBe(1);
    expect(paginated.totalPages).toBe(2);
  });

  it('deve utilizar fallback gracioso de metadados caso o servico de catalogo falhe', async () => {
    const repository = new InMemoryPreferenceRepository();
    const failingCatalogService = {
      getMovieDetails: async () => {
        throw new Error('TMDB connection error');
      },
    } as any;

    const service = new PreferenceService(repository, failingCatalogService);

    await service.recordPreference(user1, 999, PreferenceStatus.ALREADY_WATCHED);

    const history = await service.getUserEnrichedHistory(user1);
    expect(history.totalResults).toBe(1);
    expect(history.items[0]?.movie.tmdbId).toBe(999);
    expect(history.items[0]?.movie.title).toBe('Filme #999');
    expect(history.items[0]?.movie.overview).toBe('Sinopse indisponível no momento.');
  });
});
