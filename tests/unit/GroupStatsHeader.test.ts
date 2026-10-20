import { describe, expect, it } from 'vitest';
import React from 'react';
import {
  formatComplicityMessage,
  formatGenrePillText,
  formatRuntimeMessage,
  GroupStatsHeader,
} from '../../src/mobile/components/GroupStatsHeader.js';
import { GroupStats } from '../../src/core/domain/types/schemas.js';

describe('GroupStatsHeader Unit Tests', () => {
  describe('pure formatters', () => {
    it('deve formatar mensagem de cumplicidade para zero, um e múltiplos filmes', () => {
      expect(formatComplicityMessage(0)).toBe('Nenhum filme assistido juntos ainda');
      expect(formatComplicityMessage(1)).toBe('Vocês já assistiram 1 filme juntos');
      expect(formatComplicityMessage(32)).toBe('Vocês já assistiram 32 filmes juntos');
    });

    it('deve formatar tempo acumulado de cinema compartilhado em minutos e horas', () => {
      expect(formatRuntimeMessage(0)).toBe('0 min de cinema compartilhado');
      expect(formatRuntimeMessage(-5)).toBe('0 min de cinema compartilhado');
      expect(formatRuntimeMessage(45)).toBe('45m de cinema compartilhado');
      expect(formatRuntimeMessage(60)).toBe('1h de cinema compartilhado');
      expect(formatRuntimeMessage(125)).toBe('2h 5m de cinema compartilhado');
    });

    it('deve formatar texto da pílula de gênero com nome e contagem', () => {
      expect(formatGenrePillText({ id: 28, name: 'Ação', count: 7 })).toBe('Ação (7)');
      expect(formatGenrePillText({ id: 18, name: 'Drama', count: 1 })).toBe('Drama (1)');
    });
  });

  describe('component rendering', () => {
    const emptyStats: GroupStats = {
      totalMoviesWatched: 0,
      totalRuntimeMinutes: 0,
      totalRuntimeHours: 0,
      totalRuntimeFormatted: '0m',
      topGenres: [],
      lastWatchedAt: null,
    };

    const populatedStats: GroupStats = {
      totalMoviesWatched: 5,
      totalRuntimeMinutes: 620,
      totalRuntimeHours: 10.3,
      totalRuntimeFormatted: '10h 20m',
      topGenres: [
        { id: 28, name: 'Ação', count: 4 },
        { id: 878, name: 'Ficção científica', count: 3 },
      ],
      lastWatchedAt: new Date('2026-03-20T22:00:00Z'),
    };

    it('deve instanciar GroupStatsHeader com estado vazio preservando props', () => {
      const element = React.createElement(GroupStatsHeader, {
        stats: emptyStats,
        groupName: 'Cineclube Amigos',
      });

      expect(element).toBeDefined();
      expect(element.props.stats.totalMoviesWatched).toBe(0);
      expect(element.props.groupName).toBe('Cineclube Amigos');
    });

    it('deve instanciar GroupStatsHeader com estatísticas populadas e pílulas de gênero', () => {
      const element = React.createElement(GroupStatsHeader, {
        stats: populatedStats,
        groupName: 'Sessão Pipoca',
        selectedGenreId: 28,
      });

      expect(element).toBeDefined();
      expect(element.props.stats.totalMoviesWatched).toBe(5);
      expect(element.props.stats.totalRuntimeMinutes).toBe(620);
      expect(element.props.stats.topGenres).toHaveLength(2);
      expect(element.props.selectedGenreId).toBe(28);
    });

    it('deve instanciar GroupStatsHeader e acessar props sem erros estruturais', () => {
      const element = React.createElement(GroupStatsHeader, {
        stats: populatedStats,
        groupName: 'Cine Pipoca',
      });

      expect(element).toBeDefined();
      expect(element.type).toBe(GroupStatsHeader);
      expect(element.props.groupName).toBe('Cine Pipoca');
    });
  });
});
