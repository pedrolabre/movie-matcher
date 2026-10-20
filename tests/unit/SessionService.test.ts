import { beforeEach, describe, expect, it } from 'vitest';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import {
  formatRuntime,
  GroupNotFoundError,
  InvalidSessionStateError,
  MatchNotFoundError,
  SessionNotFoundError,
  SessionService,
} from '../../src/core/services/SessionService.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import { InMemoryMatchRepository } from '../../src/infrastructure/database/repositories/MatchRepository.js';
import { InMemorySessionRepository } from '../../src/infrastructure/database/repositories/SessionRepository.js';
import { CatalogService } from '../../src/core/services/CatalogService.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';

describe('SessionService Unit Tests', () => {
  let sessionRepo: InMemorySessionRepository;
  let matchRepo: InMemoryMatchRepository;
  let groupRepo: InMemoryGroupRepository;
  let sessionService: SessionService;

  const validGroupId = 'group-1111-1111-1111-111111111111';
  const otherGroupId = 'group-2222-2222-2222-222222222222';
  const validMatchId = 'match-1111-1111-1111-111111111111';
  const archivedMatchId = 'match-2222-2222-2222-222222222222';

  beforeEach(async () => {
    sessionRepo = new InMemorySessionRepository();
    matchRepo = new InMemoryMatchRepository();
    groupRepo = new InMemoryGroupRepository();
    sessionService = new SessionService(sessionRepo, matchRepo, groupRepo);

    await groupRepo.create({
      id: validGroupId,
      name: 'Cinema dos Amigos',
      inviteCode: 'CINE2026',
      createdBy: 'user-creator',
      thresholdRule: QuorumRule.MAJORITY,
      minPositiveVotes: 2,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    await matchRepo.upsertMatch({
      id: validMatchId,
      groupId: validGroupId,
      movieId: 550,
      positiveVotesCount: 3,
      quorumLevel: QuorumLevel.STRONG,
      status: MatchStatus.ACTIVE,
    });

    await matchRepo.upsertMatch({
      id: archivedMatchId,
      groupId: validGroupId,
      movieId: 680,
      positiveVotesCount: 1,
      quorumLevel: QuorumLevel.MINIMUM,
      status: MatchStatus.ARCHIVED,
    });
  });

  describe('scheduleSession', () => {
    it('deve agendar uma sessão com sucesso para um match ativo e transicionar status para SCHEDULED', async () => {
      const scheduledDate = new Date(Date.now() + 86400000);
      const notes = 'Sessão com pipoca na casa do Pedro';

      const result = await sessionService.scheduleSession(
        validGroupId,
        validMatchId,
        scheduledDate,
        notes,
      );

      expect(result.session).toBeDefined();
      expect(result.session.id).toBeDefined();
      expect(result.session.groupId).toBe(validGroupId);
      expect(result.session.matchId).toBe(validMatchId);
      expect(result.session.scheduledAt).toEqual(scheduledDate);
      expect(result.session.notes).toBe(notes);
      expect(result.session.completedAt).toBeNull();

      expect(result.match.status).toBe(MatchStatus.SCHEDULED);

      const matchInDb = await matchRepo.findMatchById(validMatchId);
      expect(matchInDb?.status).toBe(MatchStatus.SCHEDULED);

      const sessionInDb = await sessionRepo.findSessionByGroupAndMatch(
        validGroupId,
        validMatchId,
      );
      expect(sessionInDb?.id).toBe(result.session.id);
    });

    it('deve atualizar uma sessão existente se o match for reagendado', async () => {
      const firstDate = new Date(Date.now() + 86400000);
      const firstResult = await sessionService.scheduleSession(
        validGroupId,
        validMatchId,
        firstDate,
        'Primeira data',
      );

      const newDate = new Date(Date.now() + 172800000);
      const updatedResult = await sessionService.scheduleSession(
        validGroupId,
        validMatchId,
        newDate,
        'Data reagendada',
      );

      expect(updatedResult.session.id).toBe(firstResult.session.id);
      expect(updatedResult.session.scheduledAt).toEqual(newDate);
      expect(updatedResult.session.notes).toBe('Data reagendada');
      expect(updatedResult.match.status).toBe(MatchStatus.SCHEDULED);
    });

    it('deve lançar GroupNotFoundError quando o grupo não existir', async () => {
      const scheduledDate = new Date(Date.now() + 86400000);

      await expect(
        sessionService.scheduleSession(
          '00000000-0000-0000-0000-000000000000',
          validMatchId,
          scheduledDate,
        ),
      ).rejects.toThrow(GroupNotFoundError);
    });

    it('deve lançar MatchNotFoundError quando o match não existir ou for de outro grupo', async () => {
      const scheduledDate = new Date(Date.now() + 86400000);

      await expect(
        sessionService.scheduleSession(
          validGroupId,
          '00000000-0000-0000-0000-000000000000',
          scheduledDate,
        ),
      ).rejects.toThrow(MatchNotFoundError);

      await groupRepo.create({
        id: otherGroupId,
        name: 'Outro Grupo',
        inviteCode: 'OUTRO1',
        createdBy: 'user-other',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await expect(
        sessionService.scheduleSession(otherGroupId, validMatchId, scheduledDate),
      ).rejects.toThrow(MatchNotFoundError);
    });

    it('deve lançar InvalidSessionStateError se o match estiver arquivado', async () => {
      const scheduledDate = new Date(Date.now() + 86400000);

      await expect(
        sessionService.scheduleSession(validGroupId, archivedMatchId, scheduledDate),
      ).rejects.toThrow(InvalidSessionStateError);
    });
  });

  describe('completeSession', () => {
    it('deve marcar uma sessão como concluída e atualizar status do match para WATCHED', async () => {
      const scheduledDate = new Date(Date.now() - 3600000);
      const scheduleResult = await sessionService.scheduleSession(
        validGroupId,
        validMatchId,
        scheduledDate,
        'Assistindo agora',
      );

      const participants = ['user-1', 'user-2', 'user-3'];
      const completeResult = await sessionService.completeSession(
        validGroupId,
        scheduleResult.session.id,
        participants,
      );

      expect(completeResult.session.completedAt).toBeInstanceOf(Date);
      expect(completeResult.session.participantIds).toEqual(participants);
      expect(completeResult.match.status).toBe(MatchStatus.WATCHED);

      const matchInDb = await matchRepo.findMatchById(validMatchId);
      expect(matchInDb?.status).toBe(MatchStatus.WATCHED);
    });

    it('deve lançar GroupNotFoundError se o grupo for inválido', async () => {
      await expect(
        sessionService.completeSession(
          '00000000-0000-0000-0000-000000000000',
          'any-session-id',
        ),
      ).rejects.toThrow(GroupNotFoundError);
    });

    it('deve lançar SessionNotFoundError se a sessão não for encontrada', async () => {
      await expect(
        sessionService.completeSession(validGroupId, 'non-existent-session-id'),
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('deve lançar MatchNotFoundError se o match associado não existir', async () => {
      const orphanSession = await sessionRepo.createSession({
        groupId: validGroupId,
        matchId: 'orphan-match-id',
        scheduledAt: new Date(),
      });

      await expect(
        sessionService.completeSession(validGroupId, orphanSession.id),
      ).rejects.toThrow(MatchNotFoundError);
    });
  });

  describe('getGroupSessions and search helpers', () => {
    it('deve listar todas as sessões agendadas do grupo', async () => {
      await sessionService.scheduleSession(
        validGroupId,
        validMatchId,
        new Date(Date.now() + 86400000),
        'Sessão 1',
      );

      const sessions = await sessionService.getGroupSessions(validGroupId);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.notes).toBe('Sessão 1');
    });

    it('deve buscar sessão por ID ou por chave composta de grupo e match', async () => {
      const result = await sessionService.scheduleSession(
        validGroupId,
        validMatchId,
        new Date(Date.now() + 86400000),
        'Buscar sessão',
      );

      const byId = await sessionService.getSessionById(result.session.id);
      expect(byId?.id).toBe(result.session.id);

      const byMatch = await sessionService.getSessionByMatch(
        validGroupId,
        validMatchId,
      );
      expect(byMatch?.id).toBe(result.session.id);

      const notFound = await sessionService.getSessionById('unknown-id');
      expect(notFound).toBeNull();
    });

    it('deve lançar GroupNotFoundError ao listar sessões de grupo inexistente', async () => {
      await expect(
        sessionService.getGroupSessions('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(GroupNotFoundError);
    });
  });

  describe('formatRuntime helper', () => {
    it('deve formatar corretamente minutos em formato legível', () => {
      expect(formatRuntime(0)).toBe('0m');
      expect(formatRuntime(-10)).toBe('0m');
      expect(formatRuntime(45)).toBe('45m');
      expect(formatRuntime(60)).toBe('1h');
      expect(formatRuntime(120)).toBe('2h');
      expect(formatRuntime(145)).toBe('2h 25m');
    });
  });

  describe('getGroupStats & getGroupHistory', () => {
    let mockCatalogService: CatalogService;

    const mockMovie1: Movie = {
      tmdbId: 550,
      title: 'Clube da Luta',
      originalTitle: 'Fight Club',
      overview: 'Um homem deprimido conhece um vendedor de sabão...',
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

    const mockMovie2: Movie = {
      tmdbId: 700,
      title: 'Pulp Fiction',
      originalTitle: 'Pulp Fiction',
      overview: 'Histórias de crime em Los Angeles...',
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

    beforeEach(() => {
      mockCatalogService = {
        getMovieDetails: async (tmdbId: number) => {
          if (tmdbId === 550) return mockMovie1;
          if (tmdbId === 700) return mockMovie2;
          return null;
        },
      } as unknown as CatalogService;

      sessionService = new SessionService(
        sessionRepo,
        matchRepo,
        groupRepo,
        mockCatalogService,
      );
    });

    it('deve retornar estatísticas zeradas quando não houver sessões concluídas', async () => {
      const stats = await sessionService.getGroupStats(validGroupId);

      expect(stats.totalMoviesWatched).toBe(0);
      expect(stats.totalRuntimeMinutes).toBe(0);
      expect(stats.totalRuntimeHours).toBe(0);
      expect(stats.totalRuntimeFormatted).toBe('0m');
      expect(stats.topGenres).toEqual([]);
      expect(stats.lastWatchedAt).toBeNull();
    });

    it('deve agregar minutos, horas e distribuição de gêneros para sessões concluídas', async () => {
      // Cria e completa primeira sessão
      const s1 = await sessionService.scheduleSession(
        validGroupId,
        validMatchId,
        new Date('2026-02-01T20:00:00Z'),
      );
      await sessionService.completeSession(validGroupId, s1.session.id, ['u1', 'u2']);

      // Cria e completa segunda sessão
      const match2Id = 'match-3333-3333-3333-333333333333';
      await matchRepo.upsertMatch({
        id: match2Id,
        groupId: validGroupId,
        movieId: 700,
        positiveVotesCount: 2,
        quorumLevel: QuorumLevel.MINIMUM,
        status: MatchStatus.ACTIVE,
      });
      const s2 = await sessionService.scheduleSession(
        validGroupId,
        match2Id,
        new Date('2026-03-01T21:00:00Z'),
      );
      await sessionService.completeSession(validGroupId, s2.session.id, ['u1', 'u3']);

      const stats = await sessionService.getGroupStats(validGroupId);

      expect(stats.totalMoviesWatched).toBe(2);
      expect(stats.totalRuntimeMinutes).toBe(139 + 154); // 293 min
      expect(stats.totalRuntimeHours).toBe(4.9);
      expect(stats.totalRuntimeFormatted).toBe('4h 53m');
      expect(stats.topGenres).toHaveLength(3);
      // Thriller aparece em ambos (count: 2)
      expect(stats.topGenres[0]?.name).toBe('Thriller');
      expect(stats.topGenres[0]?.count).toBe(2);
      expect(stats.lastWatchedAt).toBeInstanceOf(Date);
    });

    it('não deve contabilizar sessões que estão apenas agendadas ou matches ativos', async () => {
      await sessionService.scheduleSession(
        validGroupId,
        validMatchId,
        new Date('2026-05-01T20:00:00Z'),
      );

      const stats = await sessionService.getGroupStats(validGroupId);
      expect(stats.totalMoviesWatched).toBe(0);
      expect(stats.totalRuntimeMinutes).toBe(0);
    });

    it('deve retornar histórico ordenado decrescente com paginação e busca', async () => {
      // Conclui s1
      const s1 = await sessionService.scheduleSession(
        validGroupId,
        validMatchId,
        new Date('2026-01-10T20:00:00Z'),
      );
      await sessionService.completeSession(validGroupId, s1.session.id, ['user-1']);

      // Conclui s2 mais recente
      const match2Id = 'match-3333-3333-3333-333333333333';
      await matchRepo.upsertMatch({
        id: match2Id,
        groupId: validGroupId,
        movieId: 700,
        positiveVotesCount: 2,
        quorumLevel: QuorumLevel.MINIMUM,
        status: MatchStatus.ACTIVE,
      });
      const s2 = await sessionService.scheduleSession(
        validGroupId,
        match2Id,
        new Date('2026-02-15T21:00:00Z'),
      );
      await sessionService.completeSession(validGroupId, s2.session.id, ['user-2']);

      const historyResult = await sessionService.getGroupHistory(validGroupId, {
        page: 1,
        limit: 10,
      });

      expect(historyResult.total).toBe(2);
      expect(historyResult.history).toHaveLength(2);
      expect(historyResult.totalPages).toBe(1);

      // Mais recente primeiro (s2 -> Pulp Fiction)
      expect(historyResult.history[0]?.movie.title).toBe('Pulp Fiction');
      expect(historyResult.history[1]?.movie.title).toBe('Clube da Luta');

      // Teste de busca por termo
      const searchResult = await sessionService.getGroupHistory(validGroupId, {
        searchTerm: 'clube',
      });
      expect(searchResult.total).toBe(1);
      expect(searchResult.history[0]?.movie.title).toBe('Clube da Luta');

      // Teste de filtro por gênero (Drama = 18)
      const genreResult = await sessionService.getGroupHistory(validGroupId, {
        genreId: 18,
      });
      expect(genreResult.total).toBe(1);
      expect(genreResult.history[0]?.movie.title).toBe('Clube da Luta');
    });

    it('deve lançar GroupNotFoundError ao buscar histórico de grupo inexistente', async () => {
      await expect(
        sessionService.getGroupHistory('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(GroupNotFoundError);
    });
  });
});
