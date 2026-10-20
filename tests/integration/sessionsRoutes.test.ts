import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/server.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { GroupService } from '../../src/core/services/GroupService.js';
import { SessionService } from '../../src/core/services/SessionService.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import { InMemoryMatchRepository } from '../../src/infrastructure/database/repositories/MatchRepository.js';
import { InMemorySessionRepository } from '../../src/infrastructure/database/repositories/SessionRepository.js';

describe('Sessions Routes Integration Tests (/api/groups)', () => {
  it('POST /:groupId/matches/:matchId/schedule > deve retornar 400 se groupId ou matchId forem malformatados', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/groups/not-a-uuid/matches/also-not-a-uuid/schedule',
      payload: {
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('Bad Request');
  });

  it('POST /:groupId/matches/:matchId/schedule > deve retornar 400 se payload for inválido', async () => {
    const app = buildApp();
    const groupId = '11111111-1111-1111-1111-111111111111';
    const matchId = '22222222-2222-2222-2222-222222222222';

    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${groupId}/matches/${matchId}/schedule`,
      payload: {
        notes: 'Sem data',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /:groupId/matches/:matchId/schedule > deve retornar 404 se grupo ou match não existirem', async () => {
    const app = buildApp();
    const groupId = '11111111-1111-1111-1111-111111111111';
    const matchId = '22222222-2222-2222-2222-222222222222';

    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${groupId}/matches/${matchId}/schedule`,
      payload: {
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('POST /:groupId/matches/:matchId/schedule > deve agendar sessão com status 201 e transicionar match para SCHEDULED', async () => {
    const groupRepo = new InMemoryGroupRepository();
    const matchRepo = new InMemoryMatchRepository();
    const sessionRepo = new InMemorySessionRepository();

    const groupService = new GroupService(groupRepo);
    const sessionService = new SessionService(sessionRepo, matchRepo, groupRepo);

    const app = buildApp({
      groupService,
      sessionService,
      matchRepository: matchRepo,
      sessionRepository: sessionRepo,
    });

    const groupId = '11111111-1111-1111-1111-111111111111';
    const matchId = '22222222-2222-2222-2222-222222222222';

    await groupRepo.create({
      id: groupId,
      name: 'Grupo Pipoca',
      inviteCode: 'PIPOCA1',
      createdBy: 'user-creator',
      thresholdRule: QuorumRule.MAJORITY,
      minPositiveVotes: 2,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    await matchRepo.upsertMatch({
      id: matchId,
      groupId,
      movieId: 157336,
      positiveVotesCount: 3,
      quorumLevel: QuorumLevel.STRONG,
      status: MatchStatus.ACTIVE,
    });

    const scheduledDate = new Date(Date.now() + 86400000).toISOString();
    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${groupId}/matches/${matchId}/schedule`,
      payload: {
        scheduledAt: scheduledDate,
        notes: 'Sessão de Interestelar no sábado às 20h',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.session).toBeDefined();
    expect(body.session.groupId).toBe(groupId);
    expect(body.session.matchId).toBe(matchId);
    expect(body.session.notes).toBe('Sessão de Interestelar no sábado às 20h');
    expect(body.match.status).toBe(MatchStatus.SCHEDULED);
  });

  it('POST /:groupId/sessions/:sessionId/complete > deve concluir sessão com status 200 e transicionar match para WATCHED', async () => {
    const groupRepo = new InMemoryGroupRepository();
    const matchRepo = new InMemoryMatchRepository();
    const sessionRepo = new InMemorySessionRepository();

    const groupService = new GroupService(groupRepo);
    const sessionService = new SessionService(sessionRepo, matchRepo, groupRepo);

    const app = buildApp({
      groupService,
      sessionService,
      matchRepository: matchRepo,
      sessionRepository: sessionRepo,
    });

    const groupId = '11111111-1111-1111-1111-111111111111';
    const matchId = '22222222-2222-2222-2222-222222222222';

    await groupRepo.create({
      id: groupId,
      name: 'Grupo Pipoca',
      inviteCode: 'PIPOCA2',
      createdBy: 'user-creator',
      thresholdRule: QuorumRule.MAJORITY,
      minPositiveVotes: 2,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    await matchRepo.upsertMatch({
      id: matchId,
      groupId,
      movieId: 157336,
      positiveVotesCount: 3,
      quorumLevel: QuorumLevel.STRONG,
      status: MatchStatus.ACTIVE,
    });

    const scheduleRes = await sessionService.scheduleSession(
      groupId,
      matchId,
      new Date(),
      'Hoje à noite',
    );

    const participantId = '33333333-3333-3333-3333-333333333333';
    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${groupId}/sessions/${scheduleRes.session.id}/complete`,
      payload: {
        participantIds: [participantId],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.session.completedAt).toBeDefined();
    expect(body.session.participantIds).toContain(participantId);
    expect(body.match.status).toBe(MatchStatus.WATCHED);
  });

  it('GET /:groupId/sessions > deve retornar 200 e listar sessões do grupo', async () => {
    const groupRepo = new InMemoryGroupRepository();
    const matchRepo = new InMemoryMatchRepository();
    const sessionRepo = new InMemorySessionRepository();

    const groupService = new GroupService(groupRepo);
    const sessionService = new SessionService(sessionRepo, matchRepo, groupRepo);

    const app = buildApp({
      groupService,
      sessionService,
      matchRepository: matchRepo,
      sessionRepository: sessionRepo,
    });

    const groupId = '11111111-1111-1111-1111-111111111111';
    const matchId = '22222222-2222-2222-2222-222222222222';

    await groupRepo.create({
      id: groupId,
      name: 'Grupo Pipoca',
      inviteCode: 'PIPOCA3',
      createdBy: 'user-creator',
      thresholdRule: QuorumRule.MAJORITY,
      minPositiveVotes: 2,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    await matchRepo.upsertMatch({
      id: matchId,
      groupId,
      movieId: 157336,
      positiveVotesCount: 2,
      quorumLevel: QuorumLevel.MINIMUM,
      status: MatchStatus.ACTIVE,
    });

    await sessionService.scheduleSession(
      groupId,
      matchId,
      new Date(Date.now() + 86400000),
      'Sessão listada',
    );

    const response = await app.inject({
      method: 'GET',
      url: `/api/groups/${groupId}/sessions`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.groupId).toBe(groupId);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].notes).toBe('Sessão listada');
  });

  it('GET /:groupId/sessions > deve retornar 404 para grupo inexistente', async () => {
    const app = buildApp();
    const nonExistentGroupId = '00000000-0000-0000-0000-000000000999';

    const response = await app.inject({
      method: 'GET',
      url: `/api/groups/${nonExistentGroupId}/sessions`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('GET /:groupId/history > deve retornar 400 se groupId for malformatado', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/groups/not-a-uuid/history',
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /:groupId/history > deve retornar 404 se grupo não existir', async () => {
    const app = buildApp();
    const nonExistentGroupId = '00000000-0000-0000-0000-000000000999';

    const response = await app.inject({
      method: 'GET',
      url: `/api/groups/${nonExistentGroupId}/history`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('GET /:groupId/history > deve retornar histórico vazio e stats zeradas com status 200', async () => {
    const groupRepo = new InMemoryGroupRepository();
    const matchRepo = new InMemoryMatchRepository();
    const sessionRepo = new InMemorySessionRepository();

    const groupService = new GroupService(groupRepo);
    const sessionService = new SessionService(sessionRepo, matchRepo, groupRepo);

    const app = buildApp({
      groupService,
      sessionService,
      matchRepository: matchRepo,
      sessionRepository: sessionRepo,
    });

    const groupId = '11111111-1111-1111-1111-111111111111';

    await groupRepo.create({
      id: groupId,
      name: 'Grupo Pipoca',
      inviteCode: 'PIPOCA4',
      createdBy: 'user-creator',
      thresholdRule: QuorumRule.MAJORITY,
      minPositiveVotes: 2,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/groups/${groupId}/history`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.groupId).toBe(groupId);
    expect(body.stats.totalMoviesWatched).toBe(0);
    expect(body.stats.totalRuntimeMinutes).toBe(0);
    expect(body.history).toEqual([]);
    expect(body.total).toBe(0);
  });
});
