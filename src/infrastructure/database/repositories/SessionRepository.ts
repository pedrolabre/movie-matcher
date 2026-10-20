import { randomUUID } from 'node:crypto';
import { GroupWatchSession } from '../../../core/domain/entities/GroupWatchSession.js';

export interface CreateSessionInput {
  readonly id?: string | undefined;
  readonly groupId: string;
  readonly matchId: string;
  readonly scheduledAt?: Date | null | undefined;
  readonly notes?: string | null | undefined;
  readonly completedAt?: Date | null | undefined;
  readonly participantIds?: readonly string[] | null | undefined;
  readonly createdAt?: Date | undefined;
}

export interface UpdateSessionInput {
  readonly scheduledAt?: Date | null | undefined;
  readonly notes?: string | null | undefined;
  readonly completedAt?: Date | null | undefined;
  readonly participantIds?: readonly string[] | null | undefined;
}

export interface SessionRepository {
  createSession(input: CreateSessionInput): Promise<GroupWatchSession>;
  findSessionById(sessionId: string): Promise<GroupWatchSession | null>;
  findSessionByGroupAndMatch(groupId: string, matchId: string): Promise<GroupWatchSession | null>;
  findSessionsByGroupId(groupId: string): Promise<readonly GroupWatchSession[]>;
  updateSession(sessionId: string, input: UpdateSessionInput): Promise<GroupWatchSession | null>;
  deleteSession(sessionId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, GroupWatchSession>();
  private readonly groupMatchIndex = new Map<string, string>();

  private buildGroupMatchKey(groupId: string, matchId: string): string {
    return `${groupId}:${matchId}`;
  }

  async createSession(input: CreateSessionInput): Promise<GroupWatchSession> {
    const key = this.buildGroupMatchKey(input.groupId, input.matchId);
    const existingId = this.groupMatchIndex.get(key);

    if (existingId && this.sessions.has(existingId)) {
      const existing = this.sessions.get(existingId)!;
      const updated: GroupWatchSession = {
        id: existing.id,
        groupId: existing.groupId,
        matchId: existing.matchId,
        scheduledAt: input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduledAt,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        completedAt: input.completedAt !== undefined ? input.completedAt : existing.completedAt,
        participantIds: input.participantIds !== undefined ? input.participantIds : existing.participantIds,
        createdAt: existing.createdAt,
      };
      this.sessions.set(existing.id, updated);
      return updated;
    }

    const sessionId = input.id ?? randomUUID();
    const session: GroupWatchSession = {
      id: sessionId,
      groupId: input.groupId,
      matchId: input.matchId,
      scheduledAt: input.scheduledAt ?? null,
      notes: input.notes ?? null,
      completedAt: input.completedAt ?? null,
      participantIds: input.participantIds ?? null,
      createdAt: input.createdAt ?? new Date(),
    };

    this.sessions.set(sessionId, session);
    this.groupMatchIndex.set(key, sessionId);
    return session;
  }

  async findSessionById(sessionId: string): Promise<GroupWatchSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async findSessionByGroupAndMatch(
    groupId: string,
    matchId: string,
  ): Promise<GroupWatchSession | null> {
    const key = this.buildGroupMatchKey(groupId, matchId);
    const sessionId = this.groupMatchIndex.get(key);
    if (!sessionId) {
      return null;
    }
    return this.sessions.get(sessionId) ?? null;
  }

  async findSessionsByGroupId(groupId: string): Promise<readonly GroupWatchSession[]> {
    const results: GroupWatchSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.groupId === groupId) {
        results.push(session);
      }
    }
    return results.sort((a, b) => {
      const timeA = a.scheduledAt ? a.scheduledAt.getTime() : a.createdAt.getTime();
      const timeB = b.scheduledAt ? b.scheduledAt.getTime() : b.createdAt.getTime();
      return timeB - timeA;
    });
  }

  async updateSession(
    sessionId: string,
    input: UpdateSessionInput,
  ): Promise<GroupWatchSession | null> {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      return null;
    }

    const updated: GroupWatchSession = {
      ...existing,
      scheduledAt: input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduledAt,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      completedAt: input.completedAt !== undefined ? input.completedAt : existing.completedAt,
      participantIds: input.participantIds !== undefined ? input.participantIds : existing.participantIds,
    };

    this.sessions.set(sessionId, updated);
    return updated;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const key = this.buildGroupMatchKey(session.groupId, session.matchId);
    this.groupMatchIndex.delete(key);
    this.sessions.delete(sessionId);
    return true;
  }

  async clear(): Promise<void> {
    this.sessions.clear();
    this.groupMatchIndex.clear();
  }
}
