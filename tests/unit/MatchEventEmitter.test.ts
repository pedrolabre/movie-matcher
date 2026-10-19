import { describe, expect, it, vi } from 'vitest';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import {
  createMatchEventPayload,
  InMemoryMatchEventEmitter,
  MatchEventPayload,
} from '../../src/infrastructure/events/MatchEventEmitter.js';

describe('MatchEventEmitter Unit Tests', () => {
  it('deve emitir e receber evento no canal exclusivo do grupo', async () => {
    const bus = new InMemoryMatchEventEmitter();
    const groupId = 'a0000000-0000-0000-0000-000000000001';
    const received: MatchEventPayload[] = [];

    const subscription = bus.subscribe(groupId, (event) => {
      received.push(event);
    });

    const payload = createMatchEventPayload({
      groupId,
      groupName: 'Cineastas de Sexta',
      movieId: 550,
      movieTitle: 'Clube da Luta',
      quorumLevel: QuorumLevel.PERFECT,
      positiveVotesCount: 2,
      memberCount: 2,
      threshold: 2,
      voterUserIds: ['user-1', 'user-2'],
    });

    await bus.publish(payload);

    expect(received).toHaveLength(1);
    expect(received[0]?.groupId).toBe(groupId);
    expect(received[0]?.movieId).toBe(550);
    expect(received[0]?.movieTitle).toBe('Clube da Luta');
    expect(received[0]?.quorumLevel).toBe(QuorumLevel.PERFECT);
    expect(received[0]?.voterUserIds).toEqual(['user-1', 'user-2']);

    subscription.unsubscribe();
  });

  it('deve garantir isolamento entre salas, nao emitindo eventos de outros grupos', async () => {
    const bus = new InMemoryMatchEventEmitter();
    const groupA = 'a0000000-0000-0000-0000-000000000001';
    const groupB = 'b0000000-0000-0000-0000-000000000002';
    const receivedA: MatchEventPayload[] = [];
    const receivedB: MatchEventPayload[] = [];

    const subA = bus.subscribe(groupA, (event) => {
      receivedA.push(event);
    });
    const subB = bus.subscribe(groupB, (event) => {
      receivedB.push(event);
    });

    await bus.publish(
      createMatchEventPayload({
        groupId: groupA,
        groupName: 'Sala A',
        movieId: 100,
        quorumLevel: QuorumLevel.MINIMUM,
        positiveVotesCount: 2,
        memberCount: 3,
        threshold: 2,
        voterUserIds: ['u1', 'u2'],
      }),
    );

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);

    subA.unsubscribe();
    subB.unsubscribe();
  });

  it('deve capturar todos os eventos atraves de subscribeAll', async () => {
    const bus = new InMemoryMatchEventEmitter();
    const allReceived: MatchEventPayload[] = [];

    const subscription = bus.subscribeAll((event) => {
      allReceived.push(event);
    });

    await bus.publish(
      createMatchEventPayload({
        groupId: 'g-1',
        groupName: 'Sala 1',
        movieId: 101,
        quorumLevel: QuorumLevel.STRONG,
        positiveVotesCount: 3,
        memberCount: 4,
        threshold: 3,
        voterUserIds: ['u1', 'u2', 'u3'],
      }),
    );

    await bus.publish(
      createMatchEventPayload({
        groupId: 'g-2',
        groupName: 'Sala 2',
        movieId: 202,
        quorumLevel: QuorumLevel.PERFECT,
        positiveVotesCount: 2,
        memberCount: 2,
        threshold: 2,
        voterUserIds: ['u4', 'u5'],
      }),
    );

    expect(allReceived).toHaveLength(2);
    expect(allReceived[0]?.movieId).toBe(101);
    expect(allReceived[1]?.movieId).toBe(202);

    subscription.unsubscribe();
  });

  it('deve cancelar subscricao corretamente e nao disparar mais o listener', async () => {
    const bus = new InMemoryMatchEventEmitter();
    const groupId = 'g-sub';
    let callCount = 0;

    const subscription = bus.subscribe(groupId, () => {
      callCount++;
    });

    await bus.publish(
      createMatchEventPayload({
        groupId,
        groupName: 'Sala Sub',
        movieId: 999,
        quorumLevel: QuorumLevel.MINIMUM,
        positiveVotesCount: 2,
        memberCount: 2,
        threshold: 2,
        voterUserIds: ['u1', 'u2'],
      }),
    );

    expect(callCount).toBe(1);

    subscription.unsubscribe();

    await bus.publish(
      createMatchEventPayload({
        groupId,
        groupName: 'Sala Sub',
        movieId: 1000,
        quorumLevel: QuorumLevel.MINIMUM,
        positiveVotesCount: 2,
        memberCount: 2,
        threshold: 2,
        voterUserIds: ['u1', 'u2'],
      }),
    );

    expect(callCount).toBe(1);
  });

  it('deve consultar eventos recentes com suporte a limit e since', async () => {
    const bus = new InMemoryMatchEventEmitter();
    const groupId = 'g-history';

    const t1 = new Date('2026-10-01T10:00:00Z');
    const t2 = new Date('2026-10-01T11:00:00Z');
    const t3 = new Date('2026-10-01T12:00:00Z');

    await bus.publish(
      createMatchEventPayload({
        groupId,
        groupName: 'Historico',
        movieId: 1,
        quorumLevel: QuorumLevel.MINIMUM,
        positiveVotesCount: 2,
        memberCount: 2,
        threshold: 2,
        voterUserIds: ['u1', 'u2'],
        emittedAt: t1,
      }),
    );

    await bus.publish(
      createMatchEventPayload({
        groupId,
        groupName: 'Historico',
        movieId: 2,
        quorumLevel: QuorumLevel.STRONG,
        positiveVotesCount: 3,
        memberCount: 4,
        threshold: 3,
        voterUserIds: ['u1', 'u2', 'u3'],
        emittedAt: t2,
      }),
    );

    await bus.publish(
      createMatchEventPayload({
        groupId,
        groupName: 'Historico',
        movieId: 3,
        quorumLevel: QuorumLevel.PERFECT,
        positiveVotesCount: 4,
        memberCount: 4,
        threshold: 4,
        voterUserIds: ['u1', 'u2', 'u3', 'u4'],
        emittedAt: t3,
      }),
    );

    const all = await bus.getRecentEvents(groupId);
    expect(all).toHaveLength(3);

    const lastTwo = await bus.getRecentEvents(groupId, { limit: 2 });
    expect(lastTwo).toHaveLength(2);
    expect(lastTwo[0]?.movieId).toBe(2);
    expect(lastTwo[1]?.movieId).toBe(3);

    const afterT1 = await bus.getRecentEvents(groupId, { since: t1 });
    expect(afterT1).toHaveLength(2);
    expect(afterT1[0]?.movieId).toBe(2);
    expect(afterT1[1]?.movieId).toBe(3);
  });

  it('deve respeitar maxHistoryPerGroup descartando eventos antigos', async () => {
    const bus = new InMemoryMatchEventEmitter({ maxHistoryPerGroup: 3 });
    const groupId = 'g-buffer';

    for (let i = 1; i <= 5; i++) {
      await bus.publish(
        createMatchEventPayload({
          groupId,
          groupName: 'Buffer',
          movieId: i,
          quorumLevel: QuorumLevel.MINIMUM,
          positiveVotesCount: 2,
          memberCount: 2,
          threshold: 2,
          voterUserIds: ['u1', 'u2'],
        }),
      );
    }

    const events = await bus.getRecentEvents(groupId);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.movieId)).toEqual([3, 4, 5]);
  });

  it('deve limpar todos os ouvintes e historico ao invocar clear', async () => {
    const bus = new InMemoryMatchEventEmitter();
    const groupId = 'g-clear';
    const listener = vi.fn();

    bus.subscribe(groupId, listener);
    await bus.publish(
      createMatchEventPayload({
        groupId,
        groupName: 'Clear',
        movieId: 10,
        quorumLevel: QuorumLevel.MINIMUM,
        positiveVotesCount: 2,
        memberCount: 2,
        threshold: 2,
        voterUserIds: ['u1', 'u2'],
      }),
    );

    expect(listener).toHaveBeenCalledTimes(1);

    await bus.clear();

    const events = await bus.getRecentEvents(groupId);
    expect(events).toHaveLength(0);

    await bus.publish(
      createMatchEventPayload({
        groupId,
        groupName: 'Clear',
        movieId: 20,
        quorumLevel: QuorumLevel.MINIMUM,
        positiveVotesCount: 2,
        memberCount: 2,
        threshold: 2,
        voterUserIds: ['u1', 'u2'],
      }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('deve publicar evento em tempo inferior a 15ms satisfazendo o criterio de performance', async () => {
    const bus = new InMemoryMatchEventEmitter();
    const groupId = 'g-perf';
    let processed = false;

    bus.subscribe(groupId, () => {
      processed = true;
    });

    const start = performance.now();
    await bus.publish(
      createMatchEventPayload({
        groupId,
        groupName: 'Performance',
        movieId: 99,
        quorumLevel: QuorumLevel.PERFECT,
        positiveVotesCount: 2,
        memberCount: 2,
        threshold: 2,
        voterUserIds: ['u1', 'u2'],
      }),
    );
    const duration = performance.now() - start;

    expect(processed).toBe(true);
    expect(duration).toBeLessThan(15);
  });
});
