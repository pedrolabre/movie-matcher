import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/server.js';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import { InMemoryMatchRepository } from '../../src/infrastructure/database/repositories/MatchRepository.js';
import { InMemoryPreferenceRepository } from '../../src/infrastructure/database/repositories/PreferenceRepository.js';
import { InMemoryMatchEventEmitter } from '../../src/infrastructure/events/MatchEventEmitter.js';
import { PushNotificationService } from '../../src/infrastructure/notifications/PushNotificationService.js';
import { GroupService } from '../../src/core/services/GroupService.js';
import { MatchIntersectionEngine } from '../../src/core/services/MatchIntersectionEngine.js';
import { PreferenceService } from '../../src/core/services/PreferenceService.js';

describe('Events Routes & Real-time Notifications Integration Tests', () => {
  it('GET /api/groups/:groupId/events > deve retornar 400 se groupId for malformatado', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/groups/not-a-valid-uuid/events',
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('Bad Request');
  });

  it('GET /api/groups/:groupId/events > deve retornar 404 se grupo nao for encontrado', async () => {
    const app = buildApp();
    const nonExistentGroupId = '00000000-0000-0000-0000-000000000999';

    const response = await app.inject({
      method: 'GET',
      url: `/api/groups/${nonExistentGroupId}/events`,
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.message).toBe('Grupo não encontrado');
  });

  it('GET /api/groups/:groupId/events/stream > deve retornar 404 se grupo nao existir', async () => {
    const app = buildApp();
    const nonExistentGroupId = '00000000-0000-0000-0000-000000000999';

    const response = await app.inject({
      method: 'GET',
      url: `/api/groups/${nonExistentGroupId}/events/stream`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('Fluxo E2E: deve emitir evento de match e registrar notificacao quando quorum for alcancado', async () => {
    const groupRepo = new InMemoryGroupRepository();
    const prefRepo = new InMemoryPreferenceRepository();
    const matchRepo = new InMemoryMatchRepository();
    const eventBus = new InMemoryMatchEventEmitter();
    const notificationService = new PushNotificationService();

    const groupService = new GroupService(groupRepo);
    const matchEngine = new MatchIntersectionEngine(
      prefRepo,
      groupRepo,
      matchRepo,
      eventBus,
      notificationService,
    );
    const preferenceService = new PreferenceService(prefRepo, undefined, matchEngine);

    const app = buildApp({
      groupService,
      preferenceService,
      matchRepository: matchRepo,
      matchIntersectionEngine: matchEngine,
      matchEventBus: eventBus,
      notificationService,
    });

    const user1 = '11111111-1111-1111-1111-111111111111';
    const user2 = '22222222-2222-2222-2222-222222222222';

    // 1. User 1 cria sala para dupla (UNANIMOUS, 2 membros)
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': user1 },
      payload: {
        name: 'Casal Cinema',
        thresholdRule: QuorumRule.UNANIMOUS,
        minPositiveVotes: 2,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const { group } = createRes.json();
    const groupId = group.id;
    const inviteCode = group.inviteCode;

    // 2. User 2 adere à sala via inviteCode
    const joinRes = await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      headers: { 'x-user-id': user2 },
      payload: { inviteCode },
    });
    expect(joinRes.statusCode).toBe(200);

    // 3. User 1 vota WANT_TO_WATCH no filme 157336 (Interstellar)
    const vote1Res = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': user1 },
      payload: {
        movieId: 157336,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });
    expect(vote1Res.statusCode).toBe(201);
    expect(vote1Res.json().matchesGenerated).toHaveLength(0);

    // Consulta eventos via polling: nenhum evento deve existir ainda
    const eventsEmptyRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${groupId}/events`,
    });
    expect(eventsEmptyRes.statusCode).toBe(200);
    expect(eventsEmptyRes.json().events).toHaveLength(0);

    // 4. User 2 vota WANT_TO_WATCH no mesmo filme
    const vote2Res = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': user2 },
      payload: {
        movieId: 157336,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });
    expect(vote2Res.statusCode).toBe(201);
    expect(vote2Res.json().matchesGenerated).toContain(groupId);

    // 5. Polling de eventos do grupo agora deve retornar o evento do match consensual
    const eventsMatchedRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${groupId}/events`,
    });
    expect(eventsMatchedRes.statusCode).toBe(200);
    const eventBody = eventsMatchedRes.json();
    expect(eventBody.events).toHaveLength(1);

    const matchEvent = eventBody.events[0];
    expect(matchEvent.groupId).toBe(groupId);
    expect(matchEvent.movieId).toBe(157336);
    expect(matchEvent.quorumLevel).toBe(QuorumLevel.PERFECT);
    expect(matchEvent.positiveVotesCount).toBe(2);
    expect(matchEvent.threshold).toBe(2);
    expect(matchEvent.voterUserIds).toEqual(
      expect.arrayContaining([user1, user2]),
    );

    // 6. PushNotificationService deve ter registrado notificações para ambos os membros
    const notifications = await notificationService.getDispatchedHistory();
    expect(notifications).toHaveLength(2);
    expect(notifications.map((n) => n.recipientUserId)).toEqual(
      expect.arrayContaining([user1, user2]),
    );
    expect(notifications[0]?.payload.deepLink).toBe(
      `movie-matcher://groups/${groupId}`,
    );
    expect(notifications[0]?.payload.title).toContain('Consenso Perfeito: Casal Cinema');
  });

  it('GET /api/groups/:groupId/events/stream > deve responder com headers SSE adequados e handshake', async () => {
    const groupRepo = new InMemoryGroupRepository();
    const eventBus = new InMemoryMatchEventEmitter();
    const groupService = new GroupService(groupRepo);

    const app = buildApp({
      groupService,
      matchEventBus: eventBus,
    });

    const user = '99999999-9999-9999-9999-999999999999';
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': user },
      payload: {
        name: 'SSE Room',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      },
    });
    const { group } = createRes.json();

    const response = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/events/stream?autoClose=true`,
    });

    expect(response.headers['content-type']).toBe('text/event-stream');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers['connection']).toBe('keep-alive');
    expect(response.body).toContain('event: connected');
    expect(response.body).toContain(group.id);
  });
});
