import { GroupWatchSession } from '../domain/entities/GroupWatchSession.js';
import { GroupMovieMatch } from '../domain/entities/GroupMovieMatch.js';
import { MatchStatus } from '../domain/enums/MatchStatus.js';
import { SessionRepository } from '../../infrastructure/database/repositories/SessionRepository.js';
import { MatchRepository } from '../../infrastructure/database/repositories/MatchRepository.js';
import { GroupRepository } from '../../infrastructure/database/repositories/GroupRepository.js';

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

export class SessionNotFoundError extends SessionError {
  constructor(message = 'Sessão de cinema não encontrada') {
    super(message, 404);
    this.name = 'SessionNotFoundError';
  }
}

export class MatchNotFoundError extends SessionError {
  constructor(message = 'Match não encontrado no grupo especificado') {
    super(message, 404);
    this.name = 'MatchNotFoundError';
  }
}

export class GroupNotFoundError extends SessionError {
  constructor(message = 'Grupo não encontrado') {
    super(message, 404);
    this.name = 'GroupNotFoundError';
  }
}

export class InvalidSessionStateError extends SessionError {
  constructor(message = 'Não é possível agendar sessão para um match arquivado') {
    super(message, 400);
    this.name = 'InvalidSessionStateError';
  }
}

export interface SessionOperationResult {
  readonly session: GroupWatchSession;
  readonly match: GroupMovieMatch;
}

export class SessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly matchRepository: MatchRepository,
    private readonly groupRepository: GroupRepository,
  ) {}

  getRepository(): SessionRepository {
    return this.sessionRepository;
  }

  async scheduleSession(
    groupId: string,
    matchId: string,
    scheduledAt: Date,
    notes?: string | null,
  ): Promise<SessionOperationResult> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError();
    }

    const match = await this.matchRepository.findMatchById(matchId);
    if (!match || match.groupId !== groupId) {
      throw new MatchNotFoundError();
    }

    if (match.status === MatchStatus.ARCHIVED) {
      throw new InvalidSessionStateError();
    }

    const session = await this.sessionRepository.createSession({
      groupId,
      matchId,
      scheduledAt,
      notes: notes ?? null,
      completedAt: null,
    });

    const updatedMatch = await this.matchRepository.updateMatchStatus(
      matchId,
      MatchStatus.SCHEDULED,
    );

    return {
      session,
      match: updatedMatch ?? match,
    };
  }

  async completeSession(
    groupId: string,
    sessionId: string,
    participantIds?: readonly string[],
  ): Promise<SessionOperationResult> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError();
    }

    const session = await this.sessionRepository.findSessionById(sessionId);
    if (!session || session.groupId !== groupId) {
      throw new SessionNotFoundError();
    }

    const match = await this.matchRepository.findMatchById(session.matchId);
    if (!match) {
      throw new MatchNotFoundError();
    }

    const updatedSession = await this.sessionRepository.updateSession(sessionId, {
      completedAt: new Date(),
      participantIds: participantIds ?? null,
    });

    const updatedMatch = await this.matchRepository.updateMatchStatus(
      session.matchId,
      MatchStatus.WATCHED,
    );

    return {
      session: updatedSession ?? session,
      match: updatedMatch ?? match,
    };
  }

  async getGroupSessions(groupId: string): Promise<readonly GroupWatchSession[]> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError();
    }

    return this.sessionRepository.findSessionsByGroupId(groupId);
  }

  async getSessionById(sessionId: string): Promise<GroupWatchSession | null> {
    return this.sessionRepository.findSessionById(sessionId);
  }

  async getSessionByMatch(
    groupId: string,
    matchId: string,
  ): Promise<GroupWatchSession | null> {
    return this.sessionRepository.findSessionByGroupAndMatch(groupId, matchId);
  }
}
