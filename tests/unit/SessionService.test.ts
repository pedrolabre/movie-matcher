import { beforeEach, describe, expect, it } from 'vitest';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import {
  GroupNotFoundError,
  InvalidSessionStateError,
  MatchNotFoundError,
  SessionNotFoundError,
  SessionService,
} from '../../src/core/services/SessionService.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import { InMemoryMatchRepository } from '../../src/infrastructure/database/repositories/MatchRepository.js';
import { InMemorySessionRepository } from '../../src/infrastructure/database/repositories/SessionRepository.js';

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
});
