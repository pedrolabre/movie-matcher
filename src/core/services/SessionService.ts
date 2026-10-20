import { GroupWatchSession } from '../domain/entities/GroupWatchSession.js';
import { GroupMovieMatch } from '../domain/entities/GroupMovieMatch.js';
import { Movie } from '../domain/entities/Movie.js';
import { MatchStatus } from '../domain/enums/MatchStatus.js';
import {
  GroupStats,
  ParticipantProfile,
} from '../domain/types/schemas.js';
import { SessionRepository } from '../../infrastructure/database/repositories/SessionRepository.js';
import { MatchRepository } from '../../infrastructure/database/repositories/MatchRepository.js';
import { GroupRepository } from '../../infrastructure/database/repositories/GroupRepository.js';
import { CatalogService } from './CatalogService.js';

export interface GroupHistoryItem {
  readonly session: GroupWatchSession;
  readonly match: GroupMovieMatch;
  readonly movie: Movie;
  readonly participants?: readonly ParticipantProfile[] | undefined;
}

export interface GroupHistoryResult {
  readonly groupId: string;
  readonly stats: GroupStats;
  readonly history: readonly GroupHistoryItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

export interface GetGroupHistoryOptions {
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
  readonly searchTerm?: string | undefined;
  readonly genreId?: number | undefined;
}

export function formatRuntime(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${remainingMinutes}m`;
}

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
    private readonly catalogService?: CatalogService,
  ) {}

  getRepository(): SessionRepository {
    return this.sessionRepository;
  }

  getCatalogService(): CatalogService | undefined {
    return this.catalogService;
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

  private async fetchMovieForMatch(match: GroupMovieMatch): Promise<Movie> {
    if (this.catalogService) {
      try {
        const details = await this.catalogService.getMovieDetails(match.movieId);
        if (details) {
          return details;
        }
      } catch {
        // Fallback gracioso mantendo resiliência em caso de indisponibilidade
      }
    }

    return {
      tmdbId: match.movieId,
      title: `Filme #${match.movieId}`,
      originalTitle: `Filme #${match.movieId}`,
      overview: 'Sinopse não disponível.',
      posterPath: null,
      backdropPath: null,
      releaseYear: new Date().getFullYear(),
      runtimeMinutes: 0,
      voteAverage: 0,
      genres: [],
      streamingProviders: [],
      syncedAt: new Date(),
    };
  }

  async getGroupStats(groupId: string): Promise<GroupStats> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError();
    }

    const allSessions = await this.sessionRepository.findSessionsByGroupId(groupId);
    const completedItems: Array<{ session: GroupWatchSession; match: GroupMovieMatch; movie: Movie }> = [];

    for (const session of allSessions) {
      const match = await this.matchRepository.findMatchById(session.matchId);
      if (!match) continue;

      if (session.completedAt !== null || match.status === MatchStatus.WATCHED) {
        const movie = await this.fetchMovieForMatch(match);
        completedItems.push({ session, match, movie });
      }
    }

    const totalMoviesWatched = completedItems.length;
    let totalRuntimeMinutes = 0;
    const genreMap = new Map<number, { id: number; name: string; count: number }>();
    let lastWatchedAt: Date | null = null;

    for (const item of completedItems) {
      const runtime = item.movie.runtimeMinutes ?? 0;
      totalRuntimeMinutes += runtime;

      for (const genre of item.movie.genres) {
        const existing = genreMap.get(genre.id);
        if (existing) {
          existing.count += 1;
        } else {
          genreMap.set(genre.id, { id: genre.id, name: genre.name, count: 1 });
        }
      }

      const sessionDate = item.session.completedAt ?? item.session.scheduledAt ?? item.session.createdAt;
      if (!lastWatchedAt || sessionDate.getTime() > lastWatchedAt.getTime()) {
        lastWatchedAt = sessionDate;
      }
    }

    const topGenres = Array.from(genreMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    const totalRuntimeHours = Math.round((totalRuntimeMinutes / 60) * 10) / 10;
    const totalRuntimeFormatted = formatRuntime(totalRuntimeMinutes);

    return {
      totalMoviesWatched,
      totalRuntimeMinutes,
      totalRuntimeHours,
      totalRuntimeFormatted,
      topGenres,
      lastWatchedAt,
    };
  }

  async getGroupHistory(
    groupId: string,
    options?: GetGroupHistoryOptions,
  ): Promise<GroupHistoryResult> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError();
    }

    const stats = await this.getGroupStats(groupId);
    const allSessions = await this.sessionRepository.findSessionsByGroupId(groupId);

    const historyItems: GroupHistoryItem[] = [];

    for (const session of allSessions) {
      const match = await this.matchRepository.findMatchById(session.matchId);
      if (!match) continue;

      if (session.completedAt !== null || match.status === MatchStatus.WATCHED) {
        const movie = await this.fetchMovieForMatch(match);
        const participants: ParticipantProfile[] = (session.participantIds ?? []).map((id) => ({
          id,
          displayName: `Membro ${id.slice(0, 6)}`,
          avatarUrl: null,
        }));

        historyItems.push({
          session,
          match,
          movie,
          participants: participants.length > 0 ? participants : undefined,
        });
      }
    }

    // Ordenação cronológica decrescente: completedAt mais recente primeiro
    historyItems.sort((a, b) => {
      const timeA = a.session.completedAt
        ? a.session.completedAt.getTime()
        : (a.session.scheduledAt ? a.session.scheduledAt.getTime() : a.session.createdAt.getTime());
      const timeB = b.session.completedAt
        ? b.session.completedAt.getTime()
        : (b.session.scheduledAt ? b.session.scheduledAt.getTime() : b.session.createdAt.getTime());
      return timeB - timeA;
    });

    // Filtros
    let filtered = historyItems;

    if (options?.searchTerm && options.searchTerm.trim().length > 0) {
      const term = options.searchTerm.trim().toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.movie.title.toLowerCase().includes(term) ||
          (item.movie.originalTitle ? item.movie.originalTitle.toLowerCase().includes(term) : false),
      );
    }

    if (typeof options?.genreId === 'number') {
      filtered = filtered.filter((item) =>
        item.movie.genres.some((g) => g.id === options.genreId),
      );
    }

    const total = filtered.length;
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, options?.limit ?? 20);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const startIndex = (page - 1) * limit;
    const paginatedHistory = filtered.slice(startIndex, startIndex + limit);

    return {
      groupId,
      stats,
      history: paginatedHistory,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
