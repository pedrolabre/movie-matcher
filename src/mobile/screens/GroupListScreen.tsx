import React, { useMemo, useState } from 'react';
import { Group } from '../../core/domain/entities/Group.js';
import { QuorumRule } from '../../core/domain/enums/QuorumRule.js';
import { CreateGroupDto } from '../../core/domain/types/schemas.js';
import { isValidInviteCode, sanitizeInviteCode } from '../../core/utils/inviteCode.js';
import { UserGroupMembership } from '../../infrastructure/database/repositories/GroupRepository.js';
import { GroupCard } from '../components/Group/GroupCard.js';

export interface GroupListScreenProps {
  readonly groups?: readonly UserGroupMembership[] | undefined;
  readonly isLoading?: boolean | undefined;
  readonly error?: string | null | undefined;
  readonly onCreateGroup?: ((data: CreateGroupDto) => void | Promise<void>) | undefined;
  readonly onJoinGroup?: ((inviteCode: string) => void | Promise<void>) | undefined;
  readonly onSelectGroup?: ((group: Group) => void) | undefined;
  readonly onLeaveGroup?: ((groupId: string) => void | Promise<void>) | undefined;
  readonly testId?: string | undefined;
}

export function filterGroupsByName(
  memberships: readonly UserGroupMembership[],
  searchTerm?: string,
): readonly UserGroupMembership[] {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return memberships;
  }
  const query = searchTerm.trim().toLowerCase();
  return memberships.filter((m) => m.group.name.toLowerCase().includes(query));
}

export function validateGroupName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { valid: false, error: 'O nome do grupo é obrigatório' };
  if (trimmed.length > 120) return { valid: false, error: 'Nome do grupo muito longo (máx. 120)' };
  return { valid: true };
}

export function validateInviteCodeInput(code: string): { valid: boolean; error?: string } {
  const sanitized = sanitizeInviteCode(code);
  if (!isValidInviteCode(sanitized)) {
    return { valid: false, error: 'Código deve ter de 4 a 16 caracteres alfanuméricos válidos' };
  }
  return { valid: true };
}

export const GroupListScreen: React.FC<GroupListScreenProps> = ({
  groups = [],
  isLoading = false,
  error = null,
  onCreateGroup,
  onJoinGroup,
  onSelectGroup,
  onLeaveGroup,
  testId = 'group-list-screen',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeForm, setActiveForm] = useState<'none' | 'create' | 'join'>('none');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRule, setNewGroupRule] = useState<QuorumRule>(QuorumRule.MAJORITY);
  const [newGroupMinVotes, setNewGroupMinVotes] = useState(2);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const filteredGroups = useMemo(
    () => filterGroupsByName(groups, searchTerm),
    [groups, searchTerm],
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validateGroupName(newGroupName);
    if (!val.valid) {
      setFormError(val.error ?? 'Nome inválido');
      return;
    }
    setFormError(null);
    try {
      await onCreateGroup?.({
        name: newGroupName.trim(),
        thresholdRule: newGroupRule,
        minPositiveVotes: newGroupMinVotes,
      });
      setNewGroupName('');
      setActiveForm('none');
      setFeedbackMessage('Grupo criado com sucesso!');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar grupo');
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validateInviteCodeInput(joinCodeInput);
    if (!val.valid) {
      setFormError(val.error ?? 'Código inválido');
      return;
    }
    setFormError(null);
    try {
      await onJoinGroup?.(sanitizeInviteCode(joinCodeInput));
      setJoinCodeInput('');
      setActiveForm('none');
      setFeedbackMessage('Adesão realizada com sucesso!');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao entrar no grupo');
    }
  };

  const handleCopyCode = (code: string) => {
    setFeedbackMessage(`Código ${code} copiado!`);
  };

  return (
    <div
      data-testid={testId}
      style={{
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        minHeight: '100%',
        padding: 20,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 data-testid="screen-title" style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
              Meus Grupos
            </h1>
            <p data-testid="group-count" style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: 14 }}>
              {groups.length} {groups.length === 1 ? 'grupo participante' : 'grupos participantes'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              data-testid="btn-open-create"
              onClick={() => {
                setActiveForm(activeForm === 'create' ? 'none' : 'create');
                setFormError(null);
              }}
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Criar Grupo
            </button>
            <button
              type="button"
              data-testid="btn-open-join"
              onClick={() => {
                setActiveForm(activeForm === 'join' ? 'none' : 'join');
                setFormError(null);
              }}
              style={{
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '8px 12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔑 Entrar com Código
            </button>
          </div>
        </div>

        {feedbackMessage && (
          <div
            data-testid="feedback-toast"
            style={{
              marginTop: 12,
              padding: '8px 14px',
              backgroundColor: '#10b98122',
              color: '#34d399',
              borderRadius: 8,
              border: '1px solid #059669',
              fontSize: 13,
            }}
          >
            {feedbackMessage}
          </div>
        )}

        {error && (
          <div
            data-testid="error-banner"
            style={{
              marginTop: 12,
              padding: '10px 14px',
              backgroundColor: '#ef444422',
              color: '#f87171',
              borderRadius: 8,
              border: '1px solid #b91c1c',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {activeForm === 'create' && (
          <form
            data-testid="create-group-form"
            onSubmit={handleCreateSubmit}
            style={{
              marginTop: 16,
              padding: 16,
              backgroundColor: '#1e293b',
              borderRadius: 12,
              border: '1px solid #3b82f6',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>Criar Nova Sala</h3>
            <input
              type="text"
              data-testid="input-group-name"
              placeholder="Nome da sala (ex: Cinema Sci-Fi)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: '#fff',
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <select
                data-testid="select-group-rule"
                value={newGroupRule}
                onChange={(e) => setNewGroupRule(e.target.value as QuorumRule)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #475569',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  flex: 1,
                }}
              >
                <option value={QuorumRule.MAJORITY}>Maioria Simples</option>
                <option value={QuorumRule.UNANIMOUS}>Unanimidade</option>
                <option value={QuorumRule.FIXED_COUNT}>Mínimo Fixo</option>
              </select>
              <input
                type="number"
                data-testid="input-group-min-votes"
                min={2}
                value={newGroupMinVotes}
                onChange={(e) => setNewGroupMinVotes(Number(e.target.value))}
                style={{
                  width: 80,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #475569',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              />
            </div>
            {formError && (
              <span data-testid="form-error" style={{ color: '#ef4444', fontSize: 12 }}>
                {formError}
              </span>
            )}
            <button
              type="submit"
              data-testid="btn-submit-create"
              style={{
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Confirmar Criação
            </button>
          </form>
        )}

        {activeForm === 'join' && (
          <form
            data-testid="join-group-form"
            onSubmit={handleJoinSubmit}
            style={{
              marginTop: 16,
              padding: 16,
              backgroundColor: '#1e293b',
              borderRadius: 12,
              border: '1px solid #38bdf8',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>Entrar com Código</h3>
            <input
              type="text"
              data-testid="input-invite-code"
              placeholder="Código de 6 caracteres (ex: CINE88)"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: 16,
                letterSpacing: 2,
              }}
            />
            {formError && (
              <span data-testid="form-error" style={{ color: '#ef4444', fontSize: 12 }}>
                {formError}
              </span>
            )}
            <button
              type="submit"
              data-testid="btn-submit-join"
              style={{
                padding: '8px 16px',
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Participar da Sala
            </button>
          </form>
        )}

        <div style={{ marginTop: 16 }}>
          <input
            type="text"
            data-testid="input-search-groups"
            placeholder="Filtrar grupos por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: '#fff',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </header>

      {isLoading && (
        <div data-testid="loading-indicator" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          Carregando grupos...
        </div>
      )}

      {!isLoading && filteredGroups.length === 0 && (
        <div data-testid="empty-groups-state" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          <p style={{ fontSize: 18, margin: 0 }}>Nenhum grupo encontrado</p>
          <p style={{ fontSize: 14, marginTop: 4 }}>
            Crie sua primeira sala ou use um código de convite para começar.
          </p>
        </div>
      )}

      <div data-testid="groups-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredGroups.map((membership) => (
          <GroupCard
            key={membership.group.id}
            group={membership.group}
            role={membership.role}
            memberCount={membership.memberCount}
            onSelectGroup={onSelectGroup}
            onCopyInviteCode={handleCopyCode}
            onLeaveGroup={onLeaveGroup}
          />
        ))}
      </div>
    </div>
  );
};
