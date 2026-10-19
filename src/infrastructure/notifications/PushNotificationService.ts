import { randomUUID } from 'node:crypto';
import { QuorumLevel } from '../../core/domain/enums/QuorumLevel.js';
import { MatchEventPayload } from '../events/MatchEventEmitter.js';

export interface PushNotificationPayload {
  readonly title: string;
  readonly body: string;
  readonly deepLink: string;
  readonly data: {
    readonly groupId: string;
    readonly movieId: number;
    readonly quorumLevel: QuorumLevel;
    readonly positiveVotesCount: number;
    readonly threshold: number;
  };
}

export interface DispatchedNotification {
  readonly id: string;
  readonly recipientUserId: string;
  readonly groupId: string;
  readonly payload: PushNotificationPayload;
  readonly dispatchedAt: Date;
}

export interface NotificationDispatcher {
  dispatchToMembers(
    groupId: string,
    memberUserIds: readonly string[],
    event: MatchEventPayload,
  ): Promise<readonly DispatchedNotification[]>;
  getDispatchedHistory(
    recipientUserId?: string,
  ): Promise<readonly DispatchedNotification[]>;
  clear(): Promise<void>;
}

export class PushNotificationService implements NotificationDispatcher {
  private readonly dispatchedHistory: DispatchedNotification[] = [];

  formatNotification(event: MatchEventPayload): PushNotificationPayload {
    const movieLabel = event.movieTitle ?? `Filme #${event.movieId}`;
    const deepLink = `movie-matcher://groups/${event.groupId}`;

    let title: string;
    let body: string;

    switch (event.quorumLevel) {
      case QuorumLevel.PERFECT:
        title = `🎉 Consenso Perfeito: ${event.groupName}`;
        body = `Todos os membros querem assistir a "${movieLabel}"! Que tal marcar a sessão?`;
        break;
      case QuorumLevel.STRONG:
        title = `🔥 Match Forte: ${event.groupName}`;
        body = `"${movieLabel}" atingiu ${event.positiveVotesCount} votos positivos e é um match forte!`;
        break;
      case QuorumLevel.MINIMUM:
      default:
        title = `✨ Novo Match: ${event.groupName}`;
        body = `"${movieLabel}" atingiu o quórum mínimo (${event.positiveVotesCount}/${event.threshold}) e entrou na watchlist consensual!`;
        break;
    }

    return {
      title,
      body,
      deepLink,
      data: {
        groupId: event.groupId,
        movieId: event.movieId,
        quorumLevel: event.quorumLevel,
        positiveVotesCount: event.positiveVotesCount,
        threshold: event.threshold,
      },
    };
  }

  async dispatchToMembers(
    groupId: string,
    memberUserIds: readonly string[],
    event: MatchEventPayload,
  ): Promise<readonly DispatchedNotification[]> {
    const payload = this.formatNotification(event);
    const now = new Date();
    const dispatched: DispatchedNotification[] = [];

    for (const userId of memberUserIds) {
      const notification: DispatchedNotification = {
        id: randomUUID(),
        recipientUserId: userId,
        groupId,
        payload,
        dispatchedAt: now,
      };

      this.dispatchedHistory.push(notification);
      dispatched.push(notification);
    }

    return dispatched;
  }

  async getDispatchedHistory(
    recipientUserId?: string,
  ): Promise<readonly DispatchedNotification[]> {
    if (!recipientUserId) {
      return [...this.dispatchedHistory];
    }

    return this.dispatchedHistory.filter(
      (item) => item.recipientUserId === recipientUserId,
    );
  }

  async clear(): Promise<void> {
    this.dispatchedHistory.length = 0;
  }
}
