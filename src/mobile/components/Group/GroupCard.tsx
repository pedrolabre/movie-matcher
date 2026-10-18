import React from 'react';
import { Group } from '../../../core/domain/entities/Group.js';
import { GroupRole } from '../../../core/domain/enums/GroupRole.js';
import { QuorumRule } from '../../../core/domain/enums/QuorumRule.js';

export interface GroupCardProps {
  readonly group: Group;
  readonly role?: GroupRole | undefined;
  readonly memberCount?: number | undefined;
  readonly onSelectGroup?: ((group: Group) => void) | undefined;
  readonly onCopyInviteCode?: ((inviteCode: string) => void) | undefined;
  readonly onLeaveGroup?: ((groupId: string) => void) | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly testId?: string | undefined;
}

export function formatRoleBadge(role?: GroupRole): { label: string; bg: string; color: string } {
  switch (role) {
    case GroupRole.OWNER:
      return { label: 'Proprietário', bg: '#f59e0b22', color: '#f59e0b' };
    case GroupRole.ADMIN:
      return { label: 'Admin', bg: '#3b82f622', color: '#60a5fa' };
    case GroupRole.MEMBER:
    default:
      return { label: 'Membro', bg: '#64748b22', color: '#94a3b8' };
  }
}

export function formatQuorumRuleText(rule: QuorumRule, minVotes: number): string {
  switch (rule) {
    case QuorumRule.UNANIMOUS:
      return '100% Consenso Unânime';
    case QuorumRule.MAJORITY:
      return `Maioria Simples (Mín. ${minVotes} votos)`;
    case QuorumRule.FIXED_COUNT:
      return `Mínimo Fixo (${minVotes} votos)`;
    default:
      return `Mín. ${minVotes} votos`;
  }
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  role = GroupRole.MEMBER,
  memberCount = 1,
  onSelectGroup,
  onCopyInviteCode,
  onLeaveGroup,
  style,
  testId = 'group-card',
}) => {
  const roleBadge = formatRoleBadge(role);
  const quorumText = formatQuorumRuleText(group.thresholdRule, group.minPositiveVotes);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyInviteCode?.(group.inviteCode);
  };

  const handleLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLeaveGroup?.(group.id);
  };

  const handleCardClick = () => {
    onSelectGroup?.(group);
  };

  return (
    <div
      data-testid={testId}
      onClick={handleCardClick}
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: '16px 20px',
        border: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: onSelectGroup ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3
            data-testid="group-card-name"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: '#f8fafc',
            }}
          >
            {group.name}
          </h3>
          <span
            data-testid="group-card-quorum"
            style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, display: 'inline-block' }}
          >
            ⚙️ {quorumText}
          </span>
        </div>

        <span
          data-testid="group-card-role-badge"
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: 12,
            backgroundColor: roleBadge.bg,
            color: roleBadge.color,
            letterSpacing: 0.5,
          }}
        >
          {roleBadge.label}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
          padding: '8px 12px',
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Código:</span>
          <code
            data-testid="group-card-code"
            style={{
              fontFamily: 'monospace',
              fontSize: 14,
              fontWeight: 700,
              color: '#38bdf8',
              letterSpacing: 1,
            }}
          >
            {group.inviteCode}
          </code>
        </div>

        <button
          type="button"
          data-testid="group-card-copy-btn"
          onClick={handleCopy}
          style={{
            backgroundColor: '#334155',
            border: 'none',
            borderRadius: 6,
            color: '#f8fafc',
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          Copiar
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
          paddingTop: 8,
          borderTop: '1px solid #334155',
        }}
      >
        <span data-testid="group-card-member-count" style={{ fontSize: 13, color: '#94a3b8' }}>
          👥 {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
        </span>

        {onLeaveGroup && (
          <button
            type="button"
            data-testid="group-card-leave-btn"
            onClick={handleLeave}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#ef4444',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Sair
          </button>
        )}
      </div>
    </div>
  );
};
