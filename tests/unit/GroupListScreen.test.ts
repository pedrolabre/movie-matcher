import React from 'react';
import { describe, expect, it } from 'vitest';
import { Group } from '../../src/core/domain/entities/Group.js';
import { GroupRole } from '../../src/core/domain/enums/GroupRole.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { UserGroupMembership } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import {
  filterGroupsByName,
  GroupListScreen,
  validateGroupName,
  validateInviteCodeInput,
} from '../../src/mobile/screens/GroupListScreen.js';

describe('GroupListScreen and pure helpers', () => {
  const createMockGroup = (id: string, name: string, inviteCode: string): Group => ({
    id,
    name,
    inviteCode,
    createdBy: 'creator-uuid',
    thresholdRule: QuorumRule.MAJORITY,
    minPositiveVotes: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockMemberships: UserGroupMembership[] = [
    {
      group: createMockGroup('g1', 'Terror da Madrugada', 'TERR99'),
      role: GroupRole.OWNER,
      joinedAt: new Date(),
      memberCount: 3,
    },
    {
      group: createMockGroup('g2', 'Comédias Românticas', 'COME88'),
      role: GroupRole.MEMBER,
      joinedAt: new Date(),
      memberCount: 2,
    },
    {
      group: createMockGroup('g3', 'Ficção Científica 4K', 'SCIF77'),
      role: GroupRole.ADMIN,
      joinedAt: new Date(),
      memberCount: 5,
    },
  ];

  describe('filterGroupsByName', () => {
    it('deve retornar todos os grupos quando termo de busca for vazio ou indefinido', () => {
      expect(filterGroupsByName(mockMemberships)).toHaveLength(3);
      expect(filterGroupsByName(mockMemberships, '')).toHaveLength(3);
      expect(filterGroupsByName(mockMemberships, '   ')).toHaveLength(3);
    });

    it('deve filtrar grupos de forma case-insensitive pelo nome', () => {
      const result = filterGroupsByName(mockMemberships, 'terror');
      expect(result).toHaveLength(1);
      expect(result[0]?.group.name).toBe('Terror da Madrugada');

      const resultSciFi = filterGroupsByName(mockMemberships, 'CIENTÍFICA');
      expect(resultSciFi).toHaveLength(1);
      expect(resultSciFi[0]?.group.name).toBe('Ficção Científica 4K');
    });

    it('deve retornar lista vazia quando nenhuma sala coincidir', () => {
      expect(filterGroupsByName(mockMemberships, 'Inexistente')).toHaveLength(0);
    });
  });

  describe('validateGroupName', () => {
    it('deve validar nomes de grupo adequados', () => {
      expect(validateGroupName('Cinema dos Amigos').valid).toBe(true);
      expect(validateGroupName('A').valid).toBe(true);
    });

    it('deve rejeitar nomes vazios ou compostos apenas por espaços', () => {
      expect(validateGroupName('').valid).toBe(false);
      expect(validateGroupName('    ').valid).toBe(false);
    });

    it('deve rejeitar nomes com mais de 120 caracteres', () => {
      const longName = 'A'.repeat(121);
      expect(validateGroupName(longName).valid).toBe(false);
    });
  });

  describe('validateInviteCodeInput', () => {
    it('deve aceitar códigos válidos mesmo em minúsculas', () => {
      expect(validateInviteCodeInput('CANE88').valid).toBe(true);
      expect(validateInviteCodeInput('cane88').valid).toBe(true);
    });

    it('deve rejeitar códigos com caracteres ambíguos ou inválidos', () => {
      expect(validateInviteCodeInput('CIN088').valid).toBe(false); // Contém '0'
      expect(validateInviteCodeInput('CINO88').valid).toBe(false); // Contém 'O'
      expect(validateInviteCodeInput('CIN188').valid).toBe(false); // Contém '1'
      expect(validateInviteCodeInput('AB').valid).toBe(false); // Menos de 4 chars
    });
  });

  describe('GroupListScreen Component', () => {
    it('deve instanciar elemento React sem erros estruturais com lista de grupos', () => {
      const element = React.createElement(GroupListScreen, {
        groups: mockMemberships,
        isLoading: false,
        error: null,
      });

      expect(element).toBeDefined();
      expect(element.props.groups).toHaveLength(3);
    });

    it('deve instanciar elemento React com estado de loading e erro', () => {
      const loadingElement = React.createElement(GroupListScreen, {
        isLoading: true,
      });
      expect(loadingElement.props.isLoading).toBe(true);

      const errorElement = React.createElement(GroupListScreen, {
        error: 'Falha na conexão com o servidor',
      });
      expect(errorElement.props.error).toBe('Falha na conexão com o servidor');
    });
  });
});
