import { describe, expect, it } from 'vitest';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { createMatchEventPayload } from '../../src/infrastructure/events/MatchEventEmitter.js';
import { PushNotificationService } from '../../src/infrastructure/notifications/PushNotificationService.js';

describe('PushNotificationService Unit Tests', () => {
  it('deve formatar push notification para QuorumLevel.PERFECT com deep link padronizado', () => {
    const service = new PushNotificationService();
    const groupId = 'group-uuid-123';

    const event = createMatchEventPayload({
      groupId,
      groupName: 'Casal',
      movieId: 603,
      movieTitle: 'The Matrix',
      quorumLevel: QuorumLevel.PERFECT,
      positiveVotesCount: 2,
      memberCount: 2,
      threshold: 2,
      voterUserIds: ['user-1', 'user-2'],
    });

    const notification = service.formatNotification(event);

    expect(notification.title).toBe('🎉 Consenso Perfeito: Casal');
    expect(notification.body).toContain('The Matrix');
    expect(notification.body).toContain('Todos os membros querem assistir');
    expect(notification.deepLink).toBe(`movie-matcher://groups/${groupId}`);
    expect(notification.data).toEqual({
      groupId,
      movieId: 603,
      quorumLevel: QuorumLevel.PERFECT,
      positiveVotesCount: 2,
      threshold: 2,
    });
  });

  it('deve formatar push notification para QuorumLevel.STRONG', () => {
    const service = new PushNotificationService();
    const groupId = 'group-uuid-456';

    const event = createMatchEventPayload({
      groupId,
      groupName: 'Amigos do Cinema',
      movieId: 27205,
      movieTitle: 'Inception',
      quorumLevel: QuorumLevel.STRONG,
      positiveVotesCount: 4,
      memberCount: 5,
      threshold: 3,
      voterUserIds: ['u1', 'u2', 'u3', 'u4'],
    });

    const notification = service.formatNotification(event);

    expect(notification.title).toBe('🔥 Match Forte: Amigos do Cinema');
    expect(notification.body).toContain('Inception');
    expect(notification.body).toContain('4 votos positivos');
    expect(notification.deepLink).toBe(`movie-matcher://groups/${groupId}`);
  });

  it('deve formatar push notification para QuorumLevel.MINIMUM com fallback se movieTitle ausente', () => {
    const service = new PushNotificationService();
    const groupId = 'group-uuid-789';

    const event = createMatchEventPayload({
      groupId,
      groupName: 'Terror Club',
      movieId: 9999,
      quorumLevel: QuorumLevel.MINIMUM,
      positiveVotesCount: 2,
      memberCount: 4,
      threshold: 2,
      voterUserIds: ['u1', 'u2'],
    });

    const notification = service.formatNotification(event);

    expect(notification.title).toBe('✨ Novo Match: Terror Club');
    expect(notification.body).toContain('Filme #9999');
    expect(notification.body).toContain('quórum mínimo (2/2)');
    expect(notification.deepLink).toBe(`movie-matcher://groups/${groupId}`);
  });

  it('deve despachar notificacoes para todos os membros informados e registrar no historico', async () => {
    const service = new PushNotificationService();
    const groupId = 'group-uuid-all';
    const memberIds = ['user-a', 'user-b', 'user-c'];

    const event = createMatchEventPayload({
      groupId,
      groupName: 'Trio',
      movieId: 11,
      movieTitle: 'Star Wars',
      quorumLevel: QuorumLevel.PERFECT,
      positiveVotesCount: 3,
      memberCount: 3,
      threshold: 3,
      voterUserIds: memberIds,
    });

    const dispatched = await service.dispatchToMembers(groupId, memberIds, event);

    expect(dispatched).toHaveLength(3);
    expect(dispatched.map((d) => d.recipientUserId)).toEqual(memberIds);
    expect(dispatched[0]?.payload.deepLink).toBe(`movie-matcher://groups/${groupId}`);

    const history = await service.getDispatchedHistory();
    expect(history).toHaveLength(3);

    const userBHistory = await service.getDispatchedHistory('user-b');
    expect(userBHistory).toHaveLength(1);
    expect(userBHistory[0]?.recipientUserId).toBe('user-b');
  });

  it('deve limpar historico ao invocar clear', async () => {
    const service = new PushNotificationService();
    const groupId = 'group-clean';

    await service.dispatchToMembers(
      groupId,
      ['u1'],
      createMatchEventPayload({
        groupId,
        groupName: 'Sala',
        movieId: 1,
        quorumLevel: QuorumLevel.MINIMUM,
        positiveVotesCount: 1,
        memberCount: 1,
        threshold: 1,
        voterUserIds: ['u1'],
      }),
    );

    expect(await service.getDispatchedHistory()).toHaveLength(1);

    await service.clear();

    expect(await service.getDispatchedHistory()).toHaveLength(0);
  });
});
