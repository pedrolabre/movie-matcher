import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  getAvatarBgColor,
  getInitials,
  VoterAvatarStack,
  VoterProfile,
} from '../../src/mobile/components/MatchList/VoterAvatarStack.js';

describe('VoterAvatarStack Component and Helpers', () => {
  describe('getInitials helper', () => {
    it('deve retornar "?" para valores nulos, indefinidos ou vazios', () => {
      expect(getInitials(undefined)).toBe('?');
      expect(getInitials('')).toBe('?');
      expect(getInitials('   ')).toBe('?');
    });

    it('deve extrair as 2 primeiras letras de nomes com uma única palavra', () => {
      expect(getInitials('Pedro')).toBe('PE');
      expect(getInitials('Ana')).toBe('AN');
      expect(getInitials('duna')).toBe('DU');
    });

    it('deve extrair a primeira letra do primeiro e segundo nome em nomes compostos', () => {
      expect(getInitials('Pedro Santos')).toBe('PS');
      expect(getInitials('Ana Silva')).toBe('AS');
      expect(getInitials('Carlos Eduardo Pereira')).toBe('CE');
    });
  });

  describe('getAvatarBgColor helper', () => {
    it('deve retornar cores determinísticas em formato hexadecimal para um identificador', () => {
      const color1 = getAvatarBgColor('user-uuid-1');
      const color2 = getAvatarBgColor('user-uuid-1');
      const color3 = getAvatarBgColor('user-uuid-2');

      expect(color1).toBe(color2);
      expect(color1).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color3).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('VoterAvatarStack rendering', () => {
    const mockVoters: readonly VoterProfile[] = [
      { id: '1', displayName: 'Pedro Santos', avatarUrl: 'https://example.com/p.jpg' },
      { id: '2', displayName: 'Ana Silva', avatarUrl: null },
      { id: '3', displayName: 'Lucas Mendes', avatarUrl: undefined },
      { id: '4', displayName: 'Carla Dias', avatarUrl: 'https://example.com/c.jpg' },
      { id: '5', displayName: 'Bruno Lima', avatarUrl: null },
    ];

    it('deve retornar null quando a lista de votantes for vazia ou indefinida', () => {
      const element1 = React.createElement(VoterAvatarStack, { voters: [] });
      expect(element1).toBeDefined();

      const element2 = React.createElement(VoterAvatarStack, { voters: undefined as any });
      expect(element2).toBeDefined();
    });

    it('deve instanciar a pilha de avatares com suporte a maxVisible e overflow', () => {
      const element = React.createElement(VoterAvatarStack, {
        voters: mockVoters,
        maxVisible: 3,
        size: 36,
        showCount: true,
        totalMemberCount: 6,
      });

      expect(element).toBeDefined();
      expect(element.props.voters).toHaveLength(5);
      expect(element.props.maxVisible).toBe(3);
      expect(element.props.size).toBe(36);
      expect(element.props.totalMemberCount).toBe(6);
    });

    it('deve instanciar com valores padrão e sem contagem total de membros', () => {
      const element = React.createElement(VoterAvatarStack, {
        voters: [mockVoters[0]!, mockVoters[1]!],
      });

      expect(element).toBeDefined();
      expect(element.props.voters).toHaveLength(2);
      expect(element.props.maxVisible).toBeUndefined();
    });
  });
});
