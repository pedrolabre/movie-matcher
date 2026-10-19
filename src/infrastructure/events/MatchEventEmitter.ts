import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { QuorumLevel } from '../../core/domain/enums/QuorumLevel.js';

export interface MatchEventPayload {
  readonly eventId: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly movieId: number;
  readonly movieTitle?: string | undefined;
  readonly quorumLevel: QuorumLevel;
  readonly positiveVotesCount: number;
  readonly memberCount: number;
  readonly threshold: number;
  readonly voterUserIds: readonly string[];
  readonly emittedAt: Date;
}

export type MatchEventListener = (
  payload: MatchEventPayload,
) => Promise<void> | void;

export interface EventSubscription {
  unsubscribe: () => void;
}

export interface GetRecentEventsOptions {
  readonly since?: Date | undefined;
  readonly limit?: number | undefined;
}

export interface MatchEventBus {
  publish(payload: MatchEventPayload): Promise<void>;
  subscribe(groupId: string, listener: MatchEventListener): EventSubscription;
  subscribeAll(listener: MatchEventListener): EventSubscription;
  getRecentEvents(
    groupId: string,
    options?: GetRecentEventsOptions,
  ): Promise<readonly MatchEventPayload[]>;
  clear(): Promise<void>;
}

export interface InMemoryMatchEventEmitterOptions {
  readonly maxHistoryPerGroup?: number | undefined;
}

export class InMemoryMatchEventEmitter implements MatchEventBus {
  private readonly emitter: EventEmitter;
  private readonly groupHistory: Map<string, MatchEventPayload[]>;
  private readonly maxHistoryPerGroup: number;

  constructor(options?: InMemoryMatchEventEmitterOptions) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    this.groupHistory = new Map();
    this.maxHistoryPerGroup = options?.maxHistoryPerGroup ?? 50;
  }

  private buildGroupChannel(groupId: string): string {
    return `group:${groupId}`;
  }

  async publish(payload: MatchEventPayload): Promise<void> {
    const channel = this.buildGroupChannel(payload.groupId);
    const history = this.groupHistory.get(payload.groupId) ?? [];

    history.push(payload);
    if (history.length > this.maxHistoryPerGroup) {
      history.shift();
    }
    this.groupHistory.set(payload.groupId, history);

    this.emitter.emit(channel, payload);
    this.emitter.emit('match:all', payload);
  }

  subscribe(groupId: string, listener: MatchEventListener): EventSubscription {
    const channel = this.buildGroupChannel(groupId);
    const handler = (payload: MatchEventPayload) => {
      void listener(payload);
    };

    this.emitter.on(channel, handler);

    return {
      unsubscribe: () => {
        this.emitter.off(channel, handler);
      },
    };
  }

  subscribeAll(listener: MatchEventListener): EventSubscription {
    const handler = (payload: MatchEventPayload) => {
      void listener(payload);
    };

    this.emitter.on('match:all', handler);

    return {
      unsubscribe: () => {
        this.emitter.off('match:all', handler);
      },
    };
  }

  async getRecentEvents(
    groupId: string,
    options?: GetRecentEventsOptions,
  ): Promise<readonly MatchEventPayload[]> {
    const history = this.groupHistory.get(groupId) ?? [];
    let filtered = [...history];

    if (options?.since) {
      const sinceTime = options.since.getTime();
      filtered = filtered.filter((event) => event.emittedAt.getTime() > sinceTime);
    }

    if (options?.limit && options.limit > 0) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  async clear(): Promise<void> {
    this.emitter.removeAllListeners();
    this.groupHistory.clear();
  }
}

export function createMatchEventPayload(
  data: Omit<MatchEventPayload, 'eventId' | 'emittedAt'> & {
    eventId?: string;
    emittedAt?: Date;
  },
): MatchEventPayload {
  return {
    ...data,
    eventId: data.eventId ?? randomUUID(),
    emittedAt: data.emittedAt ?? new Date(),
  };
}
