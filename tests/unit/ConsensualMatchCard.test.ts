import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';
import { GroupMovieMatch } from '../../src/core/domain/entities/GroupMovieMatch.js';
import {
  ConsensualMatchCard,
  EnrichedGroupMatch,
  formatMatchStatusBadge,
  formatQuorumBadge,
} from '../../src/mobile/components/MatchList/ConsensualMatchCard.js';

describe('ConsensualMatchCard Component and Helpers', () => {
  const mockMovie: Movie = {
    tmdbId: 157336,
    title: 'Interestelar',
    originalTitle: 'Interstellar',
    overview: 'As reservas naturais da Terra estão chegando ao fim...',
    posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropPath: '/rAiYTpiZgi0SLti13iG40m97010.jpg',
    releaseYear: 2014,
    runtimeMinutes: 169,
    voteAverage: 8.6,
    genres: [
      { id: 878, name: 'Ficção Científica' },
      { id: 18, name: 'Drama' },
    ],
    streamingProviders: [],
    syncedAt: new Date('2026-01-01'),
  };

  const mockMatch: GroupMovieMatch = {
    id: 'match-uuid-1',
    groupId: 'group-uuid-1',
    movieId: 157336,
    positiveVotesCount: 4,
    quorumLevel: QuorumLevel.STRONG,
    status: MatchStatus.ACTIVE,
    matchedAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  };

  const mockEnrichedMatch: EnrichedGroupMatch = {
    match: mockMatch,
    movie: mockMovie,
    voters: [
      { id: 'u1', displayName: 'Pedro' },
      { id: 'u2', displayName: 'Ana' },
      { id: 'u3', displayName: 'Lucas' },
      { id: 'u4', displayName: 'Carla' },
    ],
    memberCount: 5,
  };

  describe('formatQuorumBadge helper', () => {
    it('deve categorizar QuorumLevel.PERFECT com verde e rotulagem de consenso unanime', () => {
      const badge = formatQuorumBadge(QuorumLevel.PERFECT, 5, 5);
      expect(badge.label).toBe('Consenso Perfeito');
      expect(badge.color).toBe('#10b981');
      expect(badge.ratioText).toBe('5/5');
      expect(badge.description).toContain('100%');
    });

    it('deve categorizar QuorumLevel.STRONG com tom roxo e rotulagem de match forte', () => {
      const badge = formatQuorumBadge(QuorumLevel.STRONG, 4, 5);
      expect(badge.label).toBe('Match Forte');
      expect(badge.color).toBe('#a78bfa');
      expect(badge.ratioText).toBe('4/5');
    });

    it('deve categorizar QuorumLevel.MINIMUM com tom azul e rotulagem de combinacao encontrada', () => {
      const badge = formatQuorumBadge(QuorumLevel.MINIMUM, 3, 5);
      expect(badge.label).toBe('Combinação Encontrada');
      expect(badge.color).toBe('#60a5fa');
      expect(badge.ratioText).toBe('3/5');
    });

    it('deve formatar ratioText apenas com votos quando memberCount for omitido', () => {
      const badge = formatQuorumBadge(QuorumLevel.PERFECT, 2);
      expect(badge.ratioText).toBe('2 votos');
    });
  });

  describe('formatMatchStatusBadge helper', () => {
    it('deve formatar badge para ACTIVE', () => {
      const badge = formatMatchStatusBadge(MatchStatus.ACTIVE);
      expect(badge.label).toBe('Disponível');
      expect(badge.color).toBe('#10b981');
    });

    it('deve formatar badge para SCHEDULED', () => {
      const badge = formatMatchStatusBadge(MatchStatus.SCHEDULED);
      expect(badge.label).toBe('Sessão Agendada');
      expect(badge.color).toBe('#38bdf8');
    });

    it('deve formatar badge para WATCHED', () => {
      const badge = formatMatchStatusBadge(MatchStatus.WATCHED);
      expect(badge.label).toBe('Já Assistido');
      expect(badge.color).toBe('#94a3b8');
    });

    it('deve formatar badge para ARCHIVED', () => {
      const badge = formatMatchStatusBadge(MatchStatus.ARCHIVED);
      expect(badge.label).toBe('Arquivado');
      expect(badge.color).toBe('#64748b');
    });
  });

  describe('ConsensualMatchCard rendering', () => {
    it('deve renderizar o elemento React ConsensualMatchCard com os metadados corretos', () => {
      const onSchedule = vi.fn();
      const onWatchNow = vi.fn();
      const onPress = vi.fn();

      const element = React.createElement(ConsensualMatchCard, {
        match: mockEnrichedMatch,
        onSchedule,
        onWatchNow,
        onPress,
      });

      expect(element).toBeDefined();
      expect(element.props.match.movie.title).toBe('Interestelar');
      expect(element.props.match.match.quorumLevel).toBe(QuorumLevel.STRONG);
      expect(element.props.match.voters).toHaveLength(4);
      expect(element.props.match.memberCount).toBe(5);
    });

    it('deve aceitar provedores de streaming no filme e callback onProviderPress', () => {
      const onProviderPress = vi.fn();
      const matchWithStreaming: EnrichedGroupMatch = {
        ...mockEnrichedMatch,
        movie: {
          ...mockMovie,
          streamingProviders: [
            {
              providerId: 8,
              providerName: 'Netflix',
              slug: 'netflix',
              brandColor: '#E50914',
              logoPath: '/netflix.jpg',
            },
            {
              providerId: 119,
              providerName: 'Prime Video',
              slug: 'prime-video',
              brandColor: '#00A8E1',
              logoPath: '/prime.jpg',
            },
          ],
        },
      };

      const element = React.createElement(ConsensualMatchCard, {
        match: matchWithStreaming,
        onProviderPress,
      });

      expect(element).toBeDefined();
      expect(element.props.match.movie.streamingProviders).toHaveLength(2);
      expect(element.props.onProviderPress).toBe(onProviderPress);
    });
  });
});
