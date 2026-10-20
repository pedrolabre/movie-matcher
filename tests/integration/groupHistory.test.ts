import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/server.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';
import { CatalogService } from '../../src/core/services/CatalogService.js';
import { GroupService } from '../../src/core/services/GroupService.js';
import { SessionService } from '../../src/core/services/SessionService.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import { InMemoryMatchRepository } from '../../src/infrastructure/database/repositories/MatchRepository.js';
import { InMemorySessionRepository } from '../../src/infrastructure/database/repositories/SessionRepository.js';

describe('Group History & Complicity Stats Integration Tests (/api/groups/:groupId/history)', () => {
  const groupId = '11111111-1111-1111-1111-111111111111';
  const match1Id = '22222222-2222-2222-2222-222222222222';
  const match2Id = '33333333-3333-3333-3333-333333333333';
  const match3Id = '44444444-4444-4444-4444-444444444444';

  const movie1: Movie = {
    tmdbId: 550,
    title: 'Clube da Luta',
    originalTitle: 'Fight Club',
    overview: 'Um homem deprimido...',
    posterPath: '/fightclub.jpg',
    backdropPath: null,
    releaseYear: 1999,
    runtimeMinutes: 139,
    voteAverage: 8.8,
    genres: [
      { id: 18, name: 'Drama' },
      { id: 53, name: 'Thriller' },
    ],
    streamingProviders: [],
    syncedAt: new Date(),
  };

  const movie2: Movie = {
    tmdbId: 680,
    title: 'Pulp Fiction',
    originalTitle: 'Pulp Fiction',
    overview: 'Histórias de crime...',
    posterPath: '/pulpfiction.jpg',
    backdropPath: null,
    releaseYear: 1994,
    runtimeMinutes: 154,
    voteAverage: 8.9,
    genres: [
      { id: 80, name: 'Crime' },
      { id: 53, name: 'Thriller' },
    ],
    streamingProviders: [],
    syncedAt: new Date(),
  };

  const movie3: Movie = {
    tmdbId: 27205,
    title: 'A Origem',
    originalTitle: 'Inception',
    overview: 'Ladrão de sonhos...',
    posterPath: '/inception.jpg',
    backdropPath: null,
    releaseYear: 2010,
    runtimeMinutes: 148,
    voteAverage: 8.8,
    genres: [{ id: 878, name: 'Ficção científica' }],
    streamingProviders: [],
    syncedAt: new Date(),
  };

  const mockCatalogService = {
    getMovieDetails: async (tmdbId: number) => {
      if (tmdbId === 550) return movie1;
      if (tmdbId === 680) return movie2;
      if (tmdbId === 27205) return movie3;
      return null;
    },
  } as unknown as CatalogService;

  it('deve retornar 200 com métricas agregadas de cumplicidade e sessões concluídas', async () => {
    const groupRepo = new InMemoryGroupRepository();
    const matchRepo = new InMemoryMatchRepository();
    const sessionRepo = new InMemorySessionRepository();

    const groupService = new GroupService(groupRepo);
    const sessionService = new SessionService(
      sessionRepo,
      matchRepo,
      groupRepo,
      mockCatalogService,
    );

    const app = buildApp({
      groupService,
      sessionService,
      catalogService: mockCatalogService,
      matchRepository: matchRepo,
      sessionRepository: sessionRepo,
    });

    await groupRepo.create({
      id: groupId,
      name: 'Cineastas de Sexta',
      inviteCode: 'CINE6TA',
      createdBy: 'user-owner',
      thresholdRule: QuorumRule.MAJORITY,
      minPositiveVotes: 2,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    // Cria Match 1 e completa sessão
    await matchRepo.upsertMatch({
      id: match1Id,
      groupId,
      movieId: 550,
      positiveVotesCount: 3,
      quorumLevel: QuorumLevel.STRONG,
      status: MatchStatus.ACTIVE,
    });
    const s1 = await sessionService.scheduleSession(
      groupId,
      match1Id,
      new Date('2026-02-10T20:00:00Z'),
      'Comentários da sessão 1',
    );
    await sessionService.completeSession(groupId, s1.session.id, ['u1', 'u2']);

    // Cria Match 2 e completa sessão mais recente
    await matchRepo.upsertMatch({
      id: match2Id,
      groupId,
      movieId: 680,
      positiveVotesCount: 2,
      quorumLevel: QuorumLevel.MINIMUM,
      status: MatchStatus.ACTIVE,
    });
    const s2 = await sessionService.scheduleSession(
      groupId,
      match2Id,
      new Date('2026-02-20T21:00:00Z'),
      'Comentários da sessão 2',
    );
    await sessionService.completeSession(groupId, s2.session.id, ['u1', 'u3']);

    // Cria Match 3 mas APENAS agenda (NÃO completa)
    await matchRepo.upsertMatch({
      id: match3Id,
      groupId,
      movieId: 27205,
      positiveVotesCount: 2,
      quorumLevel: QuorumLevel.MINIMUM,
      status: MatchStatus.ACTIVE,
    });
    await sessionService.scheduleSession(
      groupId,
      match3Id,
      new Date('2026-03-01T20:00:00Z'),
    );

    // Consulta histórico
    const response = await app.inject({
      method: 'GET',
      url: `/api/groups/${groupId}/history`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.groupId).toBe(groupId);

    // Validação de estatísticas agregadas (Match 3 agendado NÃO entra!)
    expect(body.stats.totalMoviesWatched).toBe(2);
    expect(body.stats.totalRuntimeMinutes).toBe(139 + 154); // 293
    expect(body.stats.totalRuntimeHours).toBe(4.9);
    expect(body.stats.totalRuntimeFormatted).toBe('4h 53m');
    expect(body.stats.topGenres).toEqual([
      { id: 53, name: 'Thriller', count: 2 },
      { id: 80, name: 'Crime', count: 1 },
      { id: 18, name: 'Drama', count: 1 },
    ]);
    expect(body.stats.lastWatchedAt).toBeDefined();

    // Validação de ordenação decrescente do acervo
    expect(body.total).toBe(2);
    expect(body.history).toHaveLength(2);
    expect(body.history[0].movie.title).toBe('Pulp Fiction');
    expect(body.history[0].session.notes).toBe('Comentários da sessão 2');
    expect(body.history[0].participants).toHaveLength(2);
    expect(body.history[1].movie.title).toBe('Clube da Luta');
    expect(body.history[1].session.notes).toBe('Comentários da sessão 1');

    // Validação de busca por título (?searchTerm=luta)
    const searchResponse = await app.inject({
      method: 'GET',
      url: `/api/groups/${groupId}/history?searchTerm=luta`,
    });
    expect(searchResponse.statusCode).toBe(200);
    const searchBody = searchResponse.json();
    expect(searchBody.total).toBe(1);
    expect(searchBody.history[0].movie.title).toBe('Clube da Luta');

    // Validação de filtro por gênero (?genreId=80 -> Crime)
    const genreResponse = await app.inject({
      method: 'GET',
      url: `/api/groups/${groupId}/history?genreId=80`,
    });
    expect(genreResponse.statusCode).toBe(200);
    const genreBody = genreResponse.json();
    expect(genreBody.total).toBe(1);
    expect(genreBody.history[0].movie.title).toBe('Pulp Fiction');

    // Validação de paginação (?page=1&limit=1)
    const pagedResponse = await app.inject({
      method: 'GET',
      url: `/api/groups/${groupId}/history?page=1&limit=1`,
    });
    expect(pagedResponse.statusCode).toBe(200);
    const pagedBody = pagedResponse.json();
    expect(pagedBody.page).toBe(1);
    expect(pagedBody.limit).toBe(1);
    expect(pagedBody.totalPages).toBe(2);
    expect(pagedBody.total).toBe(2);
    expect(pagedBody.history).toHaveLength(1);
    expect(pagedBody.history[0].movie.title).toBe('Pulp Fiction');
  });
});
