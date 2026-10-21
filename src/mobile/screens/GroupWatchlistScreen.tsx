import React, { useMemo, useState } from 'react';
import { Group } from '../../core/domain/entities/Group.js';
import { StreamingProvider } from '../../core/domain/entities/Movie.js';
import { MatchStatus } from '../../core/domain/enums/MatchStatus.js';
import { QuorumRule } from '../../core/domain/enums/QuorumRule.js';
import {
  ConsensualMatchCard,
  EnrichedGroupMatch,
} from '../components/MatchList/ConsensualMatchCard.js';
import { getProviderBrandColor } from '../components/StreamingBadgeList.js';
import { ScheduleSessionModal } from '../modals/ScheduleSessionModal.js';

export interface GroupWatchlistScreenProps {
  readonly group: Group;
  readonly matches: readonly EnrichedGroupMatch[];
  readonly memberCount?: number | undefined;
  readonly currentUserId?: string | undefined;
  readonly isLoading?: boolean | undefined;
  readonly errorMessage?: string | null | undefined;
  readonly onRefresh?: (() => void | Promise<void>) | undefined;
  readonly onScheduleMatch?: ((match: EnrichedGroupMatch) => void) | undefined;
  readonly onScheduleSessionConfirm?: ((match: EnrichedGroupMatch, data: { scheduledAt: Date; notes?: string | undefined }) => void | Promise<void>) | undefined;
  readonly onWatchNowMatch?: ((match: EnrichedGroupMatch) => void) | undefined;
  readonly onSelectMatch?: ((match: EnrichedGroupMatch) => void) | undefined;
  readonly selectedProviderId?: number | null | undefined;
  readonly onSelectProvider?: ((providerId: number | null) => void) | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly testId?: string | undefined;
}

export type MatchStatusTab = MatchStatus | 'ALL';
export type MatchSortOrder = 'recent' | 'votes' | 'rating' | 'title';

export interface MatchFilters {
  readonly statusTab?: MatchStatusTab | undefined;
  readonly searchTerm?: string | undefined;
  readonly genreId?: number | undefined;
  readonly providerId?: number | undefined;
}

export function extractStreamingProvidersFromMatches(
  matches: readonly EnrichedGroupMatch[],
): readonly StreamingProvider[] {
  const map = new Map<number, StreamingProvider>();
  for (const item of matches) {
    for (const provider of item.movie.streamingProviders) {
      if (!map.has(provider.providerId)) {
        map.set(provider.providerId, provider);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const priorityA = a.displayPriority ?? 99;
    const priorityB = b.displayPriority ?? 99;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.providerName.localeCompare(b.providerName);
  });
}

export function filterGroupMatches(
  matches: readonly EnrichedGroupMatch[],
  filters: MatchFilters,
): readonly EnrichedGroupMatch[] {
  const { statusTab = MatchStatus.ACTIVE, searchTerm, genreId, providerId } = filters;

  return matches.filter((item) => {
    // 1. Filtro por Aba de Status
    if (statusTab !== 'ALL') {
      if (item.match.status !== statusTab) {
        return false;
      }
    } else {
      // Na aba 'ALL', por padrão exclui ARCHIVED para preservar a lista limpa
      if (item.match.status === MatchStatus.ARCHIVED) {
        return false;
      }
    }

    // 2. Filtro por Busca Textual (Título e Título Original)
    if (searchTerm && searchTerm.trim().length > 0) {
      const term = searchTerm.trim().toLowerCase();
      const titleMatch = item.movie.title.toLowerCase().includes(term);
      const originalTitleMatch = item.movie.originalTitle
        ? item.movie.originalTitle.toLowerCase().includes(term)
        : false;

      if (!titleMatch && !originalTitleMatch) {
        return false;
      }
    }

    // 3. Filtro por Gênero
    if (typeof genreId === 'number') {
      const hasGenre = item.movie.genres.some((genre) => genre.id === genreId);
      if (!hasGenre) {
        return false;
      }
    }

    // 4. Filtro por Provedor de Streaming
    if (typeof providerId === 'number' && providerId > 0) {
      const hasProvider = item.movie.streamingProviders.some(
        (provider) => provider.providerId === providerId,
      );
      if (!hasProvider) {
        return false;
      }
    }

    return true;
  });
}

export function sortGroupMatches(
  matches: readonly EnrichedGroupMatch[],
  sortBy: MatchSortOrder,
): readonly EnrichedGroupMatch[] {
  const copy = [...matches];

  switch (sortBy) {
    case 'votes':
      return copy.sort((a, b) => {
        if (b.match.positiveVotesCount !== a.match.positiveVotesCount) {
          return b.match.positiveVotesCount - a.match.positiveVotesCount;
        }
        return b.match.matchedAt.getTime() - a.match.matchedAt.getTime();
      });
    case 'rating':
      return copy.sort(
        (a, b) => (b.movie.voteAverage ?? 0) - (a.movie.voteAverage ?? 0),
      );
    case 'title':
      return copy.sort((a, b) => a.movie.title.localeCompare(b.movie.title));
    case 'recent':
    default:
      return copy.sort(
        (a, b) => b.match.matchedAt.getTime() - a.match.matchedAt.getTime(),
      );
  }
}

export function countMatchesByStatus(
  matches: readonly EnrichedGroupMatch[],
): Record<MatchStatusTab, number> {
  const counts: Record<MatchStatusTab, number> = {
    ALL: 0,
    ACTIVE: 0,
    SCHEDULED: 0,
    WATCHED: 0,
    ARCHIVED: 0,
  };

  for (const item of matches) {
    counts[item.match.status] = (counts[item.match.status] || 0) + 1;
    if (item.match.status !== MatchStatus.ARCHIVED) {
      counts.ALL += 1;
    }
  }

  return counts;
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

export const GroupWatchlistScreen: React.FC<GroupWatchlistScreenProps> = ({
  group,
  matches,
  memberCount,
  isLoading = false,
  errorMessage = null,
  onRefresh,
  onScheduleMatch,
  onScheduleSessionConfirm,
  onWatchNowMatch,
  onSelectMatch,
  selectedProviderId: initialProviderId = null,
  onSelectProvider,
  onBack,
  style,
  testId = 'group-watchlist-screen',
}) => {
  const [activeTab, setActiveTab] = useState<MatchStatusTab>(MatchStatus.ACTIVE);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(initialProviderId);
  const [sortBy, setSortBy] = useState<MatchSortOrder>('recent');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [schedulingMatch, setSchedulingMatch] = useState<EnrichedGroupMatch | null>(null);
  const [isScheduling, setIsScheduling] = useState<boolean>(false);

  const counts = useMemo(() => countMatchesByStatus(matches), [matches]);
  const availableProviders = useMemo(
    () => extractStreamingProvidersFromMatches(matches),
    [matches],
  );

  const filteredMatches = useMemo(() => {
    const filtered = filterGroupMatches(matches, {
      statusTab: activeTab,
      searchTerm,
      providerId: selectedProviderId ?? undefined,
    });
    return sortGroupMatches(filtered, sortBy);
  }, [matches, activeTab, searchTerm, selectedProviderId, sortBy]);

  const handleToggleProvider = (providerId: number | null) => {
    const next = selectedProviderId === providerId ? null : providerId;
    setSelectedProviderId(next);
    onSelectProvider?.(next);
  };

  const quorumDescription = formatQuorumRuleText(
    group.thresholdRule,
    group.minPositiveVotes,
  );

  const handleSchedule = (match: EnrichedGroupMatch) => {
    setSchedulingMatch(match);
    setToastMessage(`Sessão agendada para "${match.movie.title}"!`);
    onScheduleMatch?.(match);
  };

  const handleConfirmSchedule = async (data: { scheduledAt: Date; notes?: string | undefined }) => {
    if (!schedulingMatch) return;
    setIsScheduling(true);
    try {
      if (onScheduleSessionConfirm) {
        await onScheduleSessionConfirm(schedulingMatch, data);
      }
      setToastMessage(`Sessão agendada para "${schedulingMatch.movie.title}"!`);
      setSchedulingMatch(null);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleWatchNow = (match: EnrichedGroupMatch) => {
    setToastMessage(`Iniciando sessão de "${match.movie.title}"!`);
    onWatchNowMatch?.(match);
  };

  const handleDismissToast = () => {
    setToastMessage(null);
  };

  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '20px 16px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          data-testid="watchlist-toast"
          onClick={handleDismissToast}
          style={{
            position: 'sticky',
            top: 10,
            zIndex: 50,
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: 12,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <span>🎉 {toastMessage}</span>
          <span style={{ fontSize: 18, marginLeft: 12 }}>×</span>
        </div>
      )}

      {/* Cabeçalho da Sala */}
      <div
        data-testid="watchlist-header"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onBack && (
              <button
                type="button"
                data-testid="watchlist-back-button"
                onClick={onBack}
                aria-label="Voltar"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 22,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
              >
                ←
              </button>
            )}

            <div>
              <h1
                data-testid="watchlist-group-name"
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#ffffff',
                }}
              >
                {group.name}
              </h1>
              <span
                data-testid="watchlist-quorum-info"
                style={{
                  fontSize: 12,
                  color: '#94a3b8',
                }}
              >
                {quorumDescription} {memberCount ? `• ${memberCount} membros` : ''}
              </span>
            </div>
          </div>

          {onRefresh && (
            <button
              type="button"
              data-testid="watchlist-refresh-button"
              onClick={() => onRefresh()}
              aria-label="Atualizar matches"
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#cbd5e1',
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>↻</span>
              <span>Atualizar</span>
            </button>
          )}
        </div>

        {/* Contador Geral de Matches Consensuais */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1e293b',
            borderRadius: 12,
            padding: '10px 16px',
            border: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🍿</span>
            <span
              data-testid="watchlist-total-count"
              style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}
            >
              {counts.ALL} {counts.ALL === 1 ? 'filme combinado' : 'filmes combinados'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label
              htmlFor="watchlist-sort-select"
              style={{ fontSize: 12, color: '#94a3b8' }}
            >
              Ordenar:
            </label>
            <select
              id="watchlist-sort-select"
              data-testid="watchlist-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as MatchSortOrder)}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: 8,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <option value="recent">Mais Recentes</option>
              <option value="votes">Mais Votados</option>
              <option value="rating">Melhor Nota</option>
              <option value="title">Título (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Abas de Filtro de Status */}
      <div
        data-testid="watchlist-status-tabs"
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        <button
          type="button"
          data-testid="tab-active"
          onClick={() => setActiveTab(MatchStatus.ACTIVE)}
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border: activeTab === MatchStatus.ACTIVE ? 'none' : '1px solid #334155',
            backgroundColor:
              activeTab === MatchStatus.ACTIVE ? '#2563eb' : '#1e293b',
            color: activeTab === MatchStatus.ACTIVE ? '#ffffff' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>Matches Ativos</span>
          <span
            style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            {counts.ACTIVE}
          </span>
        </button>

        <button
          type="button"
          data-testid="tab-scheduled"
          onClick={() => setActiveTab(MatchStatus.SCHEDULED)}
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border:
              activeTab === MatchStatus.SCHEDULED ? 'none' : '1px solid #334155',
            backgroundColor:
              activeTab === MatchStatus.SCHEDULED ? '#0284c7' : '#1e293b',
            color: activeTab === MatchStatus.SCHEDULED ? '#ffffff' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>Agendados</span>
          <span
            style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            {counts.SCHEDULED}
          </span>
        </button>

        <button
          type="button"
          data-testid="tab-watched"
          onClick={() => setActiveTab(MatchStatus.WATCHED)}
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border:
              activeTab === MatchStatus.WATCHED ? 'none' : '1px solid #334155',
            backgroundColor:
              activeTab === MatchStatus.WATCHED ? '#475569' : '#1e293b',
            color: activeTab === MatchStatus.WATCHED ? '#ffffff' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>Já Assistidos</span>
          <span
            style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            {counts.WATCHED}
          </span>
        </button>

        <button
          type="button"
          data-testid="tab-all"
          onClick={() => setActiveTab('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border: activeTab === 'ALL' ? 'none' : '1px solid #334155',
            backgroundColor: activeTab === 'ALL' ? '#334155' : '#1e293b',
            color: activeTab === 'ALL' ? '#ffffff' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>Todos</span>
          <span
            style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            {counts.ALL}
          </span>
        </button>
      </div>

      {/* Campo de Busca Local por Título */}
      <div
        style={{
          position: 'relative',
          marginBottom: 20,
        }}
      >
        <input
          type="text"
          data-testid="watchlist-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar filme na watchlist consensual..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#ffffff',
            padding: '12px 40px 12px 14px',
            borderRadius: 12,
            fontSize: 14,
            outline: 'none',
          }}
        />
        {searchTerm.length > 0 && (
          <button
            type="button"
            data-testid="watchlist-search-clear"
            onClick={() => setSearchTerm('')}
            aria-label="Limpar busca"
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filtro Interativo por Provedor de Streaming */}
      {availableProviders.length > 0 && (
        <div
          data-testid="watchlist-streaming-filters"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#94a3b8',
              whiteSpace: 'nowrap',
            }}
          >
            Streaming:
          </span>

          <button
            type="button"
            data-testid="streaming-filter-all"
            onClick={() => handleToggleProvider(null)}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: selectedProviderId === null ? 'none' : '1px solid #334155',
              backgroundColor:
                selectedProviderId === null ? '#3b82f6' : '#1e293b',
              color: selectedProviderId === null ? '#ffffff' : '#94a3b8',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            Todos
          </button>

          {availableProviders.map((provider) => {
            const isSelected = selectedProviderId === provider.providerId;
            const count = matches.filter((m) =>
              m.movie.streamingProviders.some((p) => p.providerId === provider.providerId),
            ).length;
            const brandColor = getProviderBrandColor(provider);

            return (
              <button
                key={provider.providerId}
                type="button"
                data-testid={`streaming-filter-${provider.providerId}`}
                data-selected={isSelected}
                onClick={() => handleToggleProvider(provider.providerId)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: isSelected
                    ? `2px solid ${brandColor || '#3b82f6'}`
                    : '1px solid #334155',
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : '#1e293b',
                  color: isSelected ? '#ffffff' : '#cbd5e1',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {provider.logoPath ? (
                  <img
                    src={provider.logoPath}
                    alt={provider.providerName}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: brandColor,
                    }}
                  />
                )}
                <span>{provider.providerName}</span>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.75,
                    padding: '1px 5px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Feedback de Carregamento */}
      {isLoading && (
        <div
          data-testid="watchlist-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            gap: 12,
            color: '#94a3b8',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid #334155',
              borderTopColor: '#3b82f6',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span>Carregando watchlist consensual...</span>
        </div>
      )}

      {/* Feedback de Erro */}
      {!isLoading && errorMessage && (
        <div
          data-testid="watchlist-error"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: 12,
            padding: 16,
            color: '#fca5a5',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
          }}
        >
          <span>⚠️ {errorMessage}</span>
          {onRefresh && (
            <button
              type="button"
              data-testid="watchlist-retry-button"
              onClick={() => onRefresh()}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tentar Novamente
            </button>
          )}
        </div>
      )}

      {/* Lista de Filmes Consensuais */}
      {!isLoading && !errorMessage && filteredMatches.length > 0 && (
        <div
          data-testid="watchlist-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {filteredMatches.map((match) => (
            <ConsensualMatchCard
              key={match.match.id}
              match={match}
              onSchedule={handleSchedule}
              onWatchNow={handleWatchNow}
              onPress={onSelectMatch}
            />
          ))}
        </div>
      )}

      {/* Empty State Contextual */}
      {!isLoading && !errorMessage && filteredMatches.length === 0 && (
        <div
          data-testid="watchlist-empty"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: '#1e293b',
            borderRadius: 16,
            border: '1px dashed #334155',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 40 }}>
            {searchTerm.length > 0
              ? '🔍'
              : selectedProviderId !== null
                ? '📺'
                : activeTab === MatchStatus.SCHEDULED
                  ? '📅'
                  : activeTab === MatchStatus.WATCHED
                    ? '🎬'
                    : '🤝'}
          </span>

          <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
            {searchTerm.length > 0
              ? 'Nenhum filme encontrado'
              : selectedProviderId !== null
                ? 'Nenhum filme disponível neste streaming'
                : activeTab === MatchStatus.SCHEDULED
                  ? 'Nenhuma sessão agendada'
                  : activeTab === MatchStatus.WATCHED
                    ? 'Nenhum filme assistido ainda'
                    : 'Nenhum match ativo no momento'}
          </h3>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: '#94a3b8',
              maxWidth: 360,
              lineHeight: 1.5,
            }}
          >
            {searchTerm.length > 0
              ? `Não encontramos nenhum título correspondente a "${searchTerm}". Tente outro termo de busca.`
              : selectedProviderId !== null
                ? 'Não encontramos nenhum filme combinado disponível no serviço de streaming selecionado.'
                : activeTab === MatchStatus.SCHEDULED
                  ? 'Quando o grupo marcar uma data para assistir a um filme, ele aparecerá aqui.'
                  : activeTab === MatchStatus.WATCHED
                    ? 'Os filmes que vocês assistirem juntos serão guardados aqui no histórico compartilhado.'
                    : 'Nenhum filme atingiu o quórum necessário ainda. Convide os membros a darem mais swipes para gerar combinações!'}
          </p>
        </div>
      )}

      <ScheduleSessionModal
        isOpen={Boolean(schedulingMatch)}
        match={schedulingMatch}
        onClose={() => setSchedulingMatch(null)}
        onConfirm={handleConfirmSchedule}
        isLoading={isScheduling}
      />
    </div>
  );
};
