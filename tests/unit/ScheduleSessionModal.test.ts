import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GroupMovieMatch } from '../../src/core/domain/entities/GroupMovieMatch.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { EnrichedGroupMatch } from '../../src/mobile/components/MatchList/ConsensualMatchCard.js';
import {
  formatISODate,
  ScheduleSessionModal,
  validateScheduleInput,
} from '../../src/mobile/modals/ScheduleSessionModal.js';

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

describe('ScheduleSessionModal Component and Helpers', () => {
  const mockMovie: Movie = {
    tmdbId: 157336,
    title: 'Interestelar',
    originalTitle: 'Interstellar',
    overview: 'Uma equipe de astronautas viaja através de um buraco de minhoca...',
    posterPath: '/poster-interstellar.jpg',
    backdropPath: null,
    releaseYear: 2014,
    runtimeMinutes: 169,
    voteAverage: 8.6,
    genres: [{ id: 878, name: 'Ficção Científica' }],
    streamingProviders: [],
    syncedAt: new Date('2026-01-01'),
  };

  const mockMatch: GroupMovieMatch = {
    id: 'match-1',
    groupId: 'group-1',
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
    voters: [{ id: 'u1', displayName: 'Pedro' }],
    memberCount: 5,
  };

  describe('formatISODate helper', () => {
    it('deve formatar data no padrão YYYY-MM-DD com padding nos dígitos', () => {
      const testDate = new Date(2026, 3, 5); // 05 de Abril de 2026
      const formatted = formatISODate(testDate);
      expect(formatted).toBe('2026-04-05');
    });
  });

  describe('validateScheduleInput helper', () => {
    it('deve rejeitar quando a data for vazia', () => {
      const result = validateScheduleInput('', '20:00');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Selecione uma data para a sessão');
    });

    it('deve rejeitar quando o horário for vazio', () => {
      const result = validateScheduleInput('2026-12-01', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Selecione um horário para a sessão');
    });

    it('deve rejeitar data e horário no passado com margem de tolerância', () => {
      const pastResult = validateScheduleInput('2020-01-01', '10:00');
      expect(pastResult.isValid).toBe(false);
      expect(pastResult.error).toBe('Data e horário da sessão não podem ser no passado');
    });

    it('deve aceitar data e horário válidos no futuro', () => {
      const futureDate = formatISODate(new Date(Date.now() + 86400000));
      const result = validateScheduleInput(futureDate, '21:30');
      expect(result.isValid).toBe(true);
      expect(result.scheduledDate).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });
  });

  describe('ScheduleSessionModal rendering and interactions', () => {
    it('não deve renderizar nada quando isOpen for false', () => {
      const element = ScheduleSessionModal({
        isOpen: false,
        match: mockEnrichedMatch,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      });
      expect(element).toBeNull();
    });

    it('não deve renderizar nada quando match for null', () => {
      const element = ScheduleSessionModal({
        isOpen: true,
        match: null,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      });
      expect(element).toBeNull();
    });

    it('deve renderizar estrutura modal acessível quando isOpen for true com match', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      const element = ScheduleSessionModal({
        isOpen: true,
        match: mockEnrichedMatch,
        onClose,
        onConfirm,
      }) as React.ReactElement<any>;

      expect(element).toBeDefined();
      expect(element.props.role).toBe('dialog');
      expect(element.props['aria-modal']).toBe('true');
      expect(element.props['data-testid']).toBe('schedule-session-modal');

      const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
      expect(children).toHaveLength(2);

      const [backdrop, container] = children;
      expect(backdrop).toBeDefined();
      expect(container).toBeDefined();
      expect(backdrop!.props['data-testid']).toBe('schedule-modal-backdrop');
      expect(container!.props['data-testid']).toBe('schedule-modal-container');
    });

    it('deve acionar callback onClose ao disparar clique no backdrop', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      const element = ScheduleSessionModal({
        isOpen: true,
        match: mockEnrichedMatch,
        onClose,
        onConfirm,
      }) as React.ReactElement<any>;

      const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
      const backdrop = children[0];
      expect(backdrop).toBeDefined();

      backdrop!.props.onClick();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('deve exibir indicador de carregamento nos botões quando isLoading for true', () => {
      const element = ScheduleSessionModal({
        isOpen: true,
        match: mockEnrichedMatch,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        isLoading: true,
      }) as React.ReactElement<any>;

      expect(element).toBeDefined();
    });
  });
});
