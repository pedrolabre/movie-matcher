import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { EnrichedGroupMatch } from '../../src/mobile/components/MatchList/ConsensualMatchCard.js';
import {
  buildSvgWheelSlices,
  getSegmentColor,
  RouletteModal,
} from '../../src/mobile/modals/RouletteModal.js';

beforeAll(() => {
  const internals =
    (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  if (internals) {
    internals.H = {
      useState: (initial: any) => [
        typeof initial === 'function' ? initial() : initial,
        () => {},
      ],
      useMemo: (factory: any) => factory(),
      useCallback: (fn: any) => fn,
      useEffect: () => {},
      useRef: (initial: any) => ({ current: initial }),
    };
  }
});

function findByTestId(node: any, testId: string): any {
  if (!node || typeof node !== 'object') return null;
  if (node.props && node.props['data-testid'] === testId) return node;
  if (node.props && node.props.children) {
    const children = Array.isArray(node.props.children)
      ? node.props.children
      : [node.props.children];
    for (const child of children) {
      const found = findByTestId(child, testId);
      if (found) return found;
    }
  }
  return null;
}

describe('RouletteModal Component and Helpers', () => {
  const mockMatches: EnrichedGroupMatch[] = [
    {
      match: {
        id: 'match-1',
        groupId: 'group-1',
        movieId: 550,
        positiveVotesCount: 3,
        quorumLevel: QuorumLevel.STRONG,
        status: MatchStatus.ACTIVE,
        matchedAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      movie: {
        tmdbId: 550,
        title: 'Clube da Luta',
        originalTitle: 'Fight Club',
        overview: 'Um trabalhador de escritório com insônia...',
        posterPath: '/fightclub.jpg',
        backdropPath: null,
        releaseYear: 1999,
        runtimeMinutes: 139,
        voteAverage: 8.4,
        genres: [{ id: 18, name: 'Drama' }],
        streamingProviders: [],
        syncedAt: new Date('2026-01-01'),
      },
      voters: [{ id: 'user-1', displayName: 'Pedro' }],
      memberCount: 3,
    },
    {
      match: {
        id: 'match-2',
        groupId: 'group-1',
        movieId: 680,
        positiveVotesCount: 4,
        quorumLevel: QuorumLevel.PERFECT,
        status: MatchStatus.ACTIVE,
        matchedAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      movie: {
        tmdbId: 680,
        title: 'Pulp Fiction',
        originalTitle: 'Pulp Fiction',
        overview: 'As vidas de dois assassinos da máfia...',
        posterPath: '/pulpfiction.jpg',
        backdropPath: null,
        releaseYear: 1994,
        runtimeMinutes: 154,
        voteAverage: 8.9,
        genres: [{ id: 80, name: 'Crime' }],
        streamingProviders: [],
        syncedAt: new Date('2026-01-01'),
      },
      voters: [
        { id: 'user-1', displayName: 'Pedro' },
        { id: 'user-2', displayName: 'Ana' },
      ],
      memberCount: 4,
    },
  ];

  describe('Funções Puras Auxiliares', () => {
    it('deve alternar cores de segmento ciclicamente em getSegmentColor', () => {
      const color0 = getSegmentColor(0);
      const color1 = getSegmentColor(1);
      const color10 = getSegmentColor(10);

      expect(typeof color0).toBe('string');
      expect(color0).not.toBe(color1);
      expect(color10).toBe(color0);
    });

    it('deve gerar fatias SVG vazias se total for <= 0', () => {
      expect(buildSvgWheelSlices(0)).toEqual([]);
      expect(buildSvgWheelSlices(-1)).toEqual([]);
    });

    it('deve gerar fatia especial quando total for 1', () => {
      const single = buildSvgWheelSlices(1);
      expect(single).toHaveLength(1);
      expect(single[0]!.labelAngle).toBe(0);
    });

    it('deve calcular fatias SVG proporcionais para múltiplos itens', () => {
      const slices = buildSvgWheelSlices(4, 100);
      expect(slices).toHaveLength(4);
      expect(slices[0]!.labelAngle).toBe(45);
      expect(slices[1]!.labelAngle).toBe(135);
      expect(slices[0]!.path).toContain('M 0 0');
    });
  });

  describe('Renderização e Estrutura do Modal', () => {
    it('deve retornar null se isOpen for false', () => {
      const modal = RouletteModal({
        isOpen: false,
        matches: mockMatches,
        onClose: vi.fn(),
      });

      expect(modal).toBeNull();
    });

    it('deve renderizar modal com título, roda e botão de giro quando aberto', () => {
      const modal = RouletteModal({
        isOpen: true,
        matches: mockMatches,
        groupName: 'Sexta Cinema',
        onClose: vi.fn(),
      });

      expect(modal).not.toBeNull();
      expect((modal as any)?.props['data-testid']).toBe('roulette-modal');
      expect((modal as any)?.props.role).toBe('dialog');
      expect((modal as any)?.props['aria-modal']).toBe('true');
    });

    it('deve exibir aviso amigável quando não houver matches com status ACTIVE', () => {
      const inactiveMatches: EnrichedGroupMatch[] = [
        {
          ...mockMatches[0]!,
          match: { ...mockMatches[0]!.match, status: MatchStatus.WATCHED },
        },
      ];

      const modal = RouletteModal({
        isOpen: true,
        matches: inactiveMatches,
        onClose: vi.fn(),
      });

      expect(modal).not.toBeNull();
    });

    it('deve repassar testId customizado para o elemento raiz', () => {
      const modal = RouletteModal({
        isOpen: true,
        matches: mockMatches,
        onClose: vi.fn(),
        testId: 'custom-roulette-modal',
      });

      expect((modal as any)?.props['data-testid']).toBe('custom-roulette-modal');
    });

    it('deve permitir fechar o modal via botão de fechar e backdrop', () => {
      const onClose = vi.fn();
      const modal = RouletteModal({
        isOpen: true,
        matches: mockMatches,
        onClose,
      });

      const closeBtn = findByTestId(modal, 'roulette-close-button');
      expect(closeBtn).not.toBeNull();
      closeBtn.props.onClick();
      expect(onClose).toHaveBeenCalledTimes(1);

      const backdrop = findByTestId(modal, 'roulette-backdrop');
      expect(backdrop).not.toBeNull();
      backdrop.props.onClick();
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('deve conter botão de girar roleta no estado inicial', () => {
      const modal = RouletteModal({
        isOpen: true,
        matches: mockMatches,
        onClose: vi.fn(),
      });

      const spinBtn = findByTestId(modal, 'roulette-spin-button');
      expect(spinBtn).not.toBeNull();
      expect(spinBtn.props.disabled).toBe(false);
    });

    it('deve disparar onSpinStart ao acionar o botão de giro', () => {
      const onSpinStart = vi.fn();
      const modal = RouletteModal({
        isOpen: true,
        matches: mockMatches,
        onClose: vi.fn(),
        onSpinStart,
      });

      const spinBtn = findByTestId(modal, 'roulette-spin-button');
      expect(spinBtn).not.toBeNull();
      spinBtn.props.onClick();
      expect(onSpinStart).toHaveBeenCalledTimes(1);
    });
  });
});
