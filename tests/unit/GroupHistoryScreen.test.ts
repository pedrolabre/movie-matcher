import { describe, expect, it } from 'vitest';
import React from 'react';
import {
  filterHistoryItems,
  formatSessionDate,
  GroupHistoryScreen,
  paginateHistoryItems,
} from '../../src/mobile/screens/GroupHistoryScreen.js';
import { Group } from '../../src/core/domain/entities/Group.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { GroupStats } from '../../src/core/domain/types/schemas.js';
import { GroupHistoryItem } from '../../src/core/services/SessionService.js';

describe('GroupHistoryScreen Unit Tests', () => {
  const mockGroup: Group = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Sessão Cinema',
    inviteCode: 'CINE2026',
    createdBy: 'user-1',
    thresholdRule: QuorumRule.MAJORITY,
    minPositiveVotes: 2,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockStats: GroupStats = {
    totalMoviesWatched: 2,
    totalRuntimeMinutes: 260,
    totalRuntimeHours: 4.3,
    totalRuntimeFormatted: '4h 20m',
    topGenres: [
      { id: 28, name: 'Ação', count: 2 },
      { id: 878, name: 'Ficção científica', count: 1 },
    ],
    lastWatchedAt: new Date('2026-02-15T20:00:00Z'),
  };

  const mockHistoryItems: GroupHistoryItem[] = [
    {
      session: {
        id: 'session-1',
        groupId: mockGroup.id,
        matchId: 'match-1',
        scheduledAt: new Date('2026-02-15T20:00:00Z'),
        notes: 'Sessão com pipoca doce',
        completedAt: new Date('2026-02-15T22:30:00Z'),
        participantIds: ['u1', 'u2'],
        createdAt: new Date('2026-02-10T10:00:00Z'),
      },
      match: {
        id: 'match-1',
        groupId: mockGroup.id,
        movieId: 550,
        positiveVotesCount: 3,
        quorumLevel: QuorumLevel.STRONG,
        status: MatchStatus.WATCHED,
        matchedAt: new Date('2026-02-09T18:00:00Z'),
        updatedAt: new Date('2026-02-15T22:30:00Z'),
      },
      movie: {
        tmdbId: 550,
        title: 'Clube da Luta',
        originalTitle: 'Fight Club',
        overview: 'Um homem deprimido...',
        posterPath: '/fightclub.jpg',
        backdropPath: null,
        releaseYear: 1999,
        runtimeMinutes: 139,
        voteAverage: 8.8,
        genres: [
          { id: 28, name: 'Ação' },
          { id: 18, name: 'Drama' },
        ],
        streamingProviders: [],
        syncedAt: new Date(),
      },
      participants: [
        { id: 'u1111111-1111-1111-1111-111111111111', displayName: 'Pedro' },
        { id: 'u2222222-2222-2222-2222-222222222222', displayName: 'Ana' },
      ],
    },
    {
      session: {
        id: 'session-2',
        groupId: mockGroup.id,
        matchId: 'match-2',
        scheduledAt: new Date('2026-01-20T19:00:00Z'),
        notes: null,
        completedAt: new Date('2026-01-20T21:10:00Z'),
        participantIds: ['u1'],
        createdAt: new Date('2026-01-15T10:00:00Z'),
      },
      match: {
        id: 'match-2',
        groupId: mockGroup.id,
        movieId: 680,
        positiveVotesCount: 2,
        quorumLevel: QuorumLevel.MINIMUM,
        status: MatchStatus.WATCHED,
        matchedAt: new Date('2026-01-14T18:00:00Z'),
        updatedAt: new Date('2026-01-20T21:10:00Z'),
      },
      movie: {
        tmdbId: 680,
        title: 'Matrix',
        originalTitle: 'The Matrix',
        overview: 'Um hacker descobre a verdade...',
        posterPath: '/matrix.jpg',
        backdropPath: null,
        releaseYear: 1999,
        runtimeMinutes: 136,
        voteAverage: 8.7,
        genres: [
          { id: 28, name: 'Ação' },
          { id: 878, name: 'Ficção científica' },
        ],
        streamingProviders: [],
        syncedAt: new Date(),
      },
      participants: [{ id: 'u1111111-1111-1111-1111-111111111111', displayName: 'Pedro' }],
    },
  ];

  describe('pure helper functions', () => {
    it('deve formatar data da sessão com segurança para valores nulos ou válidos', () => {
      expect(formatSessionDate(null)).toBe('Data não registrada');
      expect(formatSessionDate(undefined)).toBe('Data não registrada');
      expect(formatSessionDate('invalid-date')).toBe('Data não registrada');

      const date = new Date('2026-05-18T12:00:00Z');
      const formatted = formatSessionDate(date);
      expect(formatted).toMatch(/Assistido em \d{2}\/\d{2}\/2026/);
    });

    it('deve filtrar itens por termo de busca no título ou título original', () => {
      const matchClube = filterHistoryItems(mockHistoryItems, { searchTerm: 'clube' });
      expect(matchClube).toHaveLength(1);
      expect(matchClube[0]?.movie.title).toBe('Clube da Luta');

      const matchMatrix = filterHistoryItems(mockHistoryItems, { searchTerm: 'matrix' });
      expect(matchMatrix).toHaveLength(1);
      expect(matchMatrix[0]?.movie.title).toBe('Matrix');

      const noMatch = filterHistoryItems(mockHistoryItems, { searchTerm: 'Inception' });
      expect(noMatch).toHaveLength(0);
    });

    it('deve filtrar itens por gênero', () => {
      // Ficção científica = 878 (Apenas Matrix)
      const sciFi = filterHistoryItems(mockHistoryItems, { genreId: 878 });
      expect(sciFi).toHaveLength(1);
      expect(sciFi[0]?.movie.title).toBe('Matrix');

      // Ação = 28 (Ambos)
      const action = filterHistoryItems(mockHistoryItems, { genreId: 28 });
      expect(action).toHaveLength(2);
    });

    it('deve paginar itens deterministicamente', () => {
      const page1 = paginateHistoryItems(mockHistoryItems, 1, 1);
      expect(page1).toHaveLength(1);
      expect(page1[0]?.movie.title).toBe('Clube da Luta');

      const page2 = paginateHistoryItems(mockHistoryItems, 2, 1);
      expect(page2).toHaveLength(1);
      expect(page2[0]?.movie.title).toBe('Matrix');

      const emptyPage = paginateHistoryItems(mockHistoryItems, 3, 1);
      expect(emptyPage).toHaveLength(0);
    });
  });

  describe('screen element structure and props', () => {
    it('deve instanciar GroupHistoryScreen com estado vazio preservando props', () => {
      const emptyStats: GroupStats = {
        totalMoviesWatched: 0,
        totalRuntimeMinutes: 0,
        totalRuntimeHours: 0,
        totalRuntimeFormatted: '0m',
        topGenres: [],
        lastWatchedAt: null,
      };

      const element = React.createElement(GroupHistoryScreen, {
        group: mockGroup,
        stats: emptyStats,
        history: [],
        memberCount: 3,
      });

      expect(element).toBeDefined();
      expect(element.props.group.name).toBe('Sessão Cinema');
      expect(element.props.memberCount).toBe(3);
      expect(element.props.history).toHaveLength(0);
      expect(element.props.stats.totalMoviesWatched).toBe(0);
    });

    it('deve suportar estado de carregamento', () => {
      const element = React.createElement(GroupHistoryScreen, {
        group: mockGroup,
        stats: mockStats,
        history: mockHistoryItems,
        isLoading: true,
      });

      expect(element.props.isLoading).toBe(true);
      expect(element.props.history).toHaveLength(2);
    });

    it('deve suportar estado de erro', () => {
      const element = React.createElement(GroupHistoryScreen, {
        group: mockGroup,
        stats: mockStats,
        history: mockHistoryItems,
        errorMessage: 'Falha na conexão com o servidor',
      });

      expect(element.props.errorMessage).toBe('Falha na conexão com o servidor');
    });

    it('deve instanciar com acervo populado contendo metadados completos e participantes', () => {
      const element = React.createElement(GroupHistoryScreen, {
        group: mockGroup,
        stats: mockStats,
        history: mockHistoryItems,
        memberCount: 4,
        pageSize: 5,
      });

      expect(element).toBeDefined();
      expect(element.props.history).toHaveLength(2);
      expect(element.props.history[0]?.movie.title).toBe('Clube da Luta');
      expect(element.props.history[0]?.participants).toHaveLength(2);
      expect(element.props.history[1]?.movie.title).toBe('Matrix');
      expect(element.props.pageSize).toBe(5);
    });
  });
});
