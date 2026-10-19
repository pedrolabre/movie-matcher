import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Group } from '../../src/core/domain/entities/Group.js';
import { GroupMovieMatch } from '../../src/core/domain/entities/GroupMovieMatch.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { EnrichedGroupMatch } from '../../src/mobile/components/MatchList/ConsensualMatchCard.js';
import {
  countMatchesByStatus,
  filterGroupMatches,
  formatQuorumRuleText,
  GroupWatchlistScreen,
  sortGroupMatches,
} from '../../src/mobile/screens/GroupWatchlistScreen.js';

beforeAll(() => {
  const internals =
    (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  if (internals) {
    internals.H = {
      useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useMemo: (factory: any) => factory(),
      useCallback: (fn: any) => fn,
      useEffect: () => {},
    };
  }
});

describe('GroupWatchlistScreen Component and Helpers', () => {
  const mockGroup: Group = {
    id: 'group-uuid-1',
    name: 'Sessão Pipoca',
    inviteCode: 'PIPOCA1',
    createdBy: 'creator-uuid',
    thresholdRule: QuorumRule.MAJORITY,
    minPositiveVotes: 2,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  function createMockEnrichedMatch(
    id: string,
    movieId: number,
    title: string,
    status: MatchStatus = MatchStatus.ACTIVE,
    votes = 3,
    rating = 8.0,
    matchedAt = new Date('2026-01-01'),
    genreId = 878,
  ): EnrichedGroupMatch {
    const movie: Movie = {
      tmdbId: movieId,
      title,
      originalTitle: `${title} Original`,
      overview: `Sinopse de ${title}`,
      posterPath: `/poster-${movieId}.jpg`,
      backdropPath: null,
      releaseYear: 2024,
      runtimeMinutes: 120,
      voteAverage: rating,
      genres: [{ id: genreId, name: 'Gênero' }],
      streamingProviders: [],
      syncedAt: new Date(),
    };

    const match: GroupMovieMatch = {
      id,
      groupId: mockGroup.id,
      movieId,
      positiveVotesCount: votes,
      quorumLevel: QuorumLevel.STRONG,
      status,
      matchedAt,
      updatedAt: matchedAt,
    };

    return {
      match,
      movie,
      voters: [{ id: 'v1', displayName: 'Pedro' }],
      memberCount: 4,
    };
  }

  const mockMatches: readonly EnrichedGroupMatch[] = [
    createMockEnrichedMatch(
      'm1',
      101,
      'Interestelar',
      MatchStatus.ACTIVE,
      4,
      8.6,
      new Date('2026-02-01'),
      878,
    ),
    createMockEnrichedMatch(
      'm2',
      102,
      'Duna: Parte 2',
      MatchStatus.ACTIVE,
      3,
      8.5,
      new Date('2026-02-05'),
      878,
    ),
    createMockEnrichedMatch(
      'm3',
      103,
      'Oppenheimer',
      MatchStatus.SCHEDULED,
      4,
      8.9,
      new Date('2026-01-15'),
      18,
    ),
    createMockEnrichedMatch(
      'm4',
      104,
      'Matrix',
      MatchStatus.WATCHED,
      4,
      8.7,
      new Date('2026-01-10'),
      878,
    ),
    createMockEnrichedMatch(
      'm5',
      105,
      'Blade Runner',
      MatchStatus.ARCHIVED,
      1,
      8.1,
      new Date('2026-01-01'),
      878,
    ),
  ];

  describe('filterGroupMatches helper', () => {
    it('deve filtrar matches pela aba de status ativa', () => {
      const activeOnly = filterGroupMatches(mockMatches, {
        statusTab: MatchStatus.ACTIVE,
      });
      expect(activeOnly).toHaveLength(2);
      expect(activeOnly.map((m) => m.movie.title)).toEqual(['Interestelar', 'Duna: Parte 2']);

      const scheduledOnly = filterGroupMatches(mockMatches, {
        statusTab: MatchStatus.SCHEDULED,
      });
      expect(scheduledOnly).toHaveLength(1);
      expect(scheduledOnly[0]?.movie.title).toBe('Oppenheimer');

      const watchedOnly = filterGroupMatches(mockMatches, {
        statusTab: MatchStatus.WATCHED,
      });
      expect(watchedOnly).toHaveLength(1);
      expect(watchedOnly[0]?.movie.title).toBe('Matrix');
    });

    it('deve retornar todos os matches não arquivados na aba ALL', () => {
      const all = filterGroupMatches(mockMatches, { statusTab: 'ALL' });
      expect(all).toHaveLength(4);
      expect(all.some((m) => m.match.status === MatchStatus.ARCHIVED)).toBe(false);
    });

    it('deve filtrar por busca textual (título)', () => {
      const filtered = filterGroupMatches(mockMatches, {
        statusTab: 'ALL',
        searchTerm: 'duna',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.movie.title).toBe('Duna: Parte 2');
    });

    it('deve filtrar por gênero cinematográfico', () => {
      const sciFiOnly = filterGroupMatches(mockMatches, {
        statusTab: 'ALL',
        genreId: 878,
      });
      expect(sciFiOnly).toHaveLength(3); // Interestelar, Duna, Matrix (Blade Runner é ARCHIVED)
    });
  });

  describe('sortGroupMatches helper', () => {
    it('deve ordenar por data mais recente (recent)', () => {
      const active = filterGroupMatches(mockMatches, { statusTab: MatchStatus.ACTIVE });
      const sorted = sortGroupMatches(active, 'recent');
      expect(sorted[0]?.movie.title).toBe('Duna: Parte 2'); // 2026-02-05
      expect(sorted[1]?.movie.title).toBe('Interestelar'); // 2026-02-01
    });

    it('deve ordenar por maior quantidade de votos (votes)', () => {
      const active = filterGroupMatches(mockMatches, { statusTab: MatchStatus.ACTIVE });
      const sorted = sortGroupMatches(active, 'votes');
      expect(sorted[0]?.movie.title).toBe('Interestelar'); // 4 votos
      expect(sorted[1]?.movie.title).toBe('Duna: Parte 2'); // 3 votos
    });

    it('deve ordenar por melhor nota média (rating)', () => {
      const active = filterGroupMatches(mockMatches, { statusTab: MatchStatus.ACTIVE });
      const sorted = sortGroupMatches(active, 'rating');
      expect(sorted[0]?.movie.title).toBe('Interestelar'); // 8.6
      expect(sorted[1]?.movie.title).toBe('Duna: Parte 2'); // 8.5
    });

    it('deve ordenar alfabeticamente por título (title)', () => {
      const active = filterGroupMatches(mockMatches, { statusTab: MatchStatus.ACTIVE });
      const sorted = sortGroupMatches(active, 'title');
      expect(sorted[0]?.movie.title).toBe('Duna: Parte 2');
      expect(sorted[1]?.movie.title).toBe('Interestelar');
    });
  });

  describe('countMatchesByStatus helper', () => {
    it('deve contabilizar matches por status com precisão', () => {
      const counts = countMatchesByStatus(mockMatches);
      expect(counts.ACTIVE).toBe(2);
      expect(counts.SCHEDULED).toBe(1);
      expect(counts.WATCHED).toBe(1);
      expect(counts.ARCHIVED).toBe(1);
      expect(counts.ALL).toBe(4);
    });
  });

  describe('formatQuorumRuleText helper', () => {
    it('deve formatar texto explicativo da regra de quorum do grupo', () => {
      expect(formatQuorumRuleText(QuorumRule.UNANIMOUS, 2)).toBe('100% Consenso Unânime');
      expect(formatQuorumRuleText(QuorumRule.MAJORITY, 2)).toBe('Maioria Simples (Mín. 2 votos)');
      expect(formatQuorumRuleText(QuorumRule.FIXED_COUNT, 3)).toBe('Mínimo Fixo (3 votos)');
    });
  });

  describe('GroupWatchlistScreen rendering', () => {
    it('deve renderizar a tela da watchlist do grupo com cabeçalho e abas', () => {
      const onSchedule = vi.fn();
      const onWatchNow = vi.fn();
      const onRefresh = vi.fn();
      const onBack = vi.fn();

      const element = React.createElement(GroupWatchlistScreen, {
        group: mockGroup,
        matches: mockMatches,
        memberCount: 4,
        onScheduleMatch: onSchedule,
        onWatchNowMatch: onWatchNow,
        onRefresh,
        onBack,
      });

      expect(element).toBeDefined();
      expect(element.props.group.name).toBe('Sessão Pipoca');
      expect(element.props.matches).toHaveLength(5);
      expect(element.props.memberCount).toBe(4);
    });

    it('deve suportar estado de carregamento e estado de erro', () => {
      const loadingElement = React.createElement(GroupWatchlistScreen, {
        group: mockGroup,
        matches: [],
        isLoading: true,
      });
      expect(loadingElement.props.isLoading).toBe(true);

      const errorElement = React.createElement(GroupWatchlistScreen, {
        group: mockGroup,
        matches: [],
        errorMessage: 'Erro ao carregar matches',
      });
      expect(errorElement.props.errorMessage).toBe('Erro ao carregar matches');
    });
  });
});
