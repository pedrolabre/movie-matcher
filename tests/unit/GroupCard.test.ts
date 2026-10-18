import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Group } from '../../src/core/domain/entities/Group.js';
import { GroupRole } from '../../src/core/domain/enums/GroupRole.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import {
  formatQuorumRuleText,
  formatRoleBadge,
  GroupCard,
} from '../../src/mobile/components/Group/GroupCard.js';

describe('GroupCard Component and Helpers', () => {
  const mockGroup: Group = {
    id: '12345678-1234-4234-8234-123456789abc',
    name: 'Cineastas de Sexta',
    inviteCode: 'CINE88',
    createdBy: 'creator-uuid',
    thresholdRule: QuorumRule.MAJORITY,
    minPositiveVotes: 2,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  it('deve formatar badge de papéis corretamente', () => {
    expect(formatRoleBadge(GroupRole.OWNER).label).toBe('Proprietário');
    expect(formatRoleBadge(GroupRole.ADMIN).label).toBe('Admin');
    expect(formatRoleBadge(GroupRole.MEMBER).label).toBe('Membro');
    expect(formatRoleBadge(undefined).label).toBe('Membro');
  });

  it('deve formatar texto explicativo de quórum', () => {
    expect(formatQuorumRuleText(QuorumRule.UNANIMOUS, 2)).toBe('100% Consenso Unânime');
    expect(formatQuorumRuleText(QuorumRule.MAJORITY, 2)).toBe('Maioria Simples (Mín. 2 votos)');
    expect(formatQuorumRuleText(QuorumRule.FIXED_COUNT, 3)).toBe('Mínimo Fixo (3 votos)');
  });

  it('deve renderizar elemento React GroupCard sem erros estruturais', () => {
    const handleSelect = vi.fn();
    const handleCopy = vi.fn();
    const handleLeave = vi.fn();

    const element = React.createElement(GroupCard, {
      group: mockGroup,
      role: GroupRole.OWNER,
      memberCount: 4,
      onSelectGroup: handleSelect,
      onCopyInviteCode: handleCopy,
      onLeaveGroup: handleLeave,
    });

    expect(element).toBeDefined();
    expect(element.props.group.name).toBe('Cineastas de Sexta');
    expect(element.props.role).toBe(GroupRole.OWNER);
    expect(element.props.memberCount).toBe(4);
  });
});
