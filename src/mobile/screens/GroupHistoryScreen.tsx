import React, { useMemo, useState } from 'react';
import { Group } from '../../core/domain/entities/Group.js';
import {
  GroupGenreStat,
  GroupStats,
} from '../../core/domain/types/schemas.js';
import { GroupHistoryItem } from '../../core/services/SessionService.js';
import { GroupStatsHeader } from '../components/GroupStatsHeader.js';

export interface GroupHistoryScreenProps {
  readonly group: Group;
  readonly stats: GroupStats;
  readonly history: readonly GroupHistoryItem[];
  readonly memberCount?: number | undefined;
  readonly isLoading?: boolean | undefined;
  readonly errorMessage?: string | null | undefined;
  readonly onRefresh?: (() => void | Promise<void>) | undefined;
  readonly onSelectSession?: ((item: GroupHistoryItem) => void) | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly pageSize?: number | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly testId?: string | undefined;
}

export function formatSessionDate(date: Date | string | null | undefined): string {
  if (!date) {
    return 'Data não registrada';
  }
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(parsed.getTime())) {
    return 'Data não registrada';
  }
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `Assistido em ${day}/${month}/${year}`;
}

export function filterHistoryItems(
  items: readonly GroupHistoryItem[],
  options: {
    searchTerm?: string | undefined;
    genreId?: number | undefined;
  },
): readonly GroupHistoryItem[] {
  const { searchTerm, genreId } = options;

  return items.filter((item) => {
    // 1. Filtro por Busca Textual
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

    // 2. Filtro por Gênero
    if (typeof genreId === 'number') {
      const hasGenre = item.movie.genres.some((g) => g.id === genreId);
      if (!hasGenre) {
        return false;
      }
    }

    return true;
  });
}

export function paginateHistoryItems(
  items: readonly GroupHistoryItem[],
  page: number,
  pageSize: number,
): readonly GroupHistoryItem[] {
  const validPage = Math.max(1, page);
  const validPageSize = Math.max(1, pageSize);
  const start = (validPage - 1) * validPageSize;
  return items.slice(start, start + validPageSize);
}

export const GroupHistoryScreen: React.FC<GroupHistoryScreenProps> = ({
  group,
  stats,
  history,
  memberCount,
  isLoading = false,
  errorMessage = null,
  onRefresh,
  onSelectSession,
  onBack,
  pageSize = 10,
  style,
  testId = 'group-history-screen',
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGenreId, setSelectedGenreId] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredItems = useMemo(() => {
    return filterHistoryItems(history, {
      searchTerm,
      genreId: selectedGenreId,
    });
  }, [history, searchTerm, selectedGenreId]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const paginatedItems = useMemo(() => {
    return paginateHistoryItems(filteredItems, currentPage, pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const handleGenreClick = (genre: GroupGenreStat) => {
    setSelectedGenreId((prev) => (prev === genre.id ? undefined : genre.id));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedGenreId(undefined);
    setCurrentPage(1);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px 16px',
        gap: 20,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Barra de Navegação Superior */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <button
              type="button"
              data-testid={`${testId}-back-button`}
              onClick={onBack}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: 12,
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Voltar
            </button>
          )}
          <div>
            <h1
              data-testid={`${testId}-group-title`}
              style={{
                fontSize: 20,
                fontWeight: 800,
                margin: 0,
                color: '#f8fafc',
              }}
            >
              {group.name}
            </h1>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Histórico & Memória de Sessões
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {typeof memberCount === 'number' && (
            <span
              data-testid={`${testId}-member-count-badge`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#94a3b8',
                backgroundColor: '#1e293b',
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid #334155',
              }}
            >
              👥 {memberCount} membros
            </span>
          )}
          {onRefresh && (
            <button
              type="button"
              data-testid={`${testId}-refresh-button`}
              onClick={() => onRefresh()}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: 12,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔄
            </button>
          )}
        </div>
      </header>

      {/* Banner de Estatísticas de Cumplicidade */}
      <GroupStatsHeader
        stats={stats}
        groupName={group.name}
        onGenreClick={handleGenreClick}
        selectedGenreId={selectedGenreId}
      />

      {/* Controles de Busca e Filtro */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            data-testid={`${testId}-search-input`}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar filme no acervo..."
            style={{
              flex: 1,
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 14,
              color: '#f8fafc',
              outline: 'none',
            }}
          />
          {(searchTerm.length > 0 || selectedGenreId !== undefined) && (
            <button
              type="button"
              data-testid={`${testId}-clear-filters-button`}
              onClick={handleClearFilters}
              style={{
                backgroundColor: '#334155',
                border: 'none',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              Limpar
            </button>
          )}
        </div>

        {selectedGenreId !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#a855f7',
            }}
          >
            <span>Filtrando por gênero selecionado</span>
            <button
              type="button"
              onClick={() => setSelectedGenreId(undefined)}
              style={{
                background: 'none',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: 12,
                padding: 0,
              }}
            >
              remover
            </button>
          </div>
        )}
      </div>

      {/* Tratamento de Erro */}
      {errorMessage && (
        <div
          data-testid={`${testId}-error-banner`}
          style={{
            backgroundColor: '#ef444422',
            border: '1px solid #ef4444',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, color: '#fca5a5' }}>{errorMessage}</span>
          {onRefresh && (
            <button
              type="button"
              data-testid={`${testId}-retry-button`}
              onClick={() => onRefresh()}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div
          data-testid={`${testId}-loading-indicator`}
          style={{
            padding: 32,
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: 14,
          }}
        >
          Carregando acervo de memórias do grupo...
        </div>
      )}

      {/* Lista de Sessões / Empty State */}
      {!isLoading && (
        <>
          {paginatedItems.length === 0 ? (
            <div
              data-testid={`${testId}-empty-state`}
              style={{
                backgroundColor: '#0f172a',
                borderRadius: 16,
                padding: 40,
                textAlign: 'center',
                border: '1px dashed #334155',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 36 }}>🍿</span>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                  color: '#f8fafc',
                }}
              >
                {searchTerm || selectedGenreId !== undefined
                  ? 'Nenhum filme encontrado'
                  : 'Nenhuma sessão assistida ainda'}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: '#94a3b8',
                  maxWidth: 360,
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {searchTerm || selectedGenreId !== undefined
                  ? 'Tente ajustar os termos de busca ou remover o filtro de gênero ativo.'
                  : 'Quando o grupo concluir sessões agendadas, todos os títulos e participantes ficarão imortalizados nesta galeria!'}
              </p>
            </div>
          ) : (
            <div
              data-testid={`${testId}-sessions-list`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {paginatedItems.map((item) => {
                const sessionDate = formatSessionDate(
                  item.session.completedAt ?? item.session.scheduledAt,
                );

                return (
                  <div
                    key={item.session.id}
                    data-testid={`${testId}-session-card-${item.session.id}`}
                    onClick={() => onSelectSession?.(item)}
                    style={{
                      backgroundColor: '#0f172a',
                      borderRadius: 16,
                      padding: 16,
                      border: '1px solid #1e293b',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      cursor: onSelectSession ? 'pointer' : 'default',
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    {/* Linha superior com data */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        data-testid={`${testId}-session-date-${item.session.id}`}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#10b981',
                          backgroundColor: '#10b98118',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid #10b98133',
                        }}
                      >
                        {sessionDate}
                      </span>
                      {typeof item.movie.voteAverage === 'number' && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#eab308',
                          }}
                        >
                          ★ {item.movie.voteAverage.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* Dados do Filme */}
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div
                        style={{
                          width: 60,
                          height: 90,
                          borderRadius: 8,
                          backgroundColor: '#1e293b',
                          flexShrink: 0,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #334155',
                        }}
                      >
                        {item.movie.posterPath ? (
                          <img
                            src={item.movie.posterPath}
                            alt={item.movie.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: 20 }}>🎬</span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          flex: 1,
                        }}
                      >
                        <h4
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            margin: 0,
                            color: '#f8fafc',
                          }}
                        >
                          {item.movie.title}
                        </h4>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            fontSize: 12,
                            color: '#94a3b8',
                          }}
                        >
                          {item.movie.releaseYear && <span>{item.movie.releaseYear}</span>}
                          {item.movie.runtimeMinutes && (
                            <span>• {item.movie.runtimeMinutes} min</span>
                          )}
                        </div>

                        {item.movie.genres.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 4,
                              marginTop: 4,
                            }}
                          >
                            {item.movie.genres.slice(0, 3).map((g) => (
                              <span
                                key={g.id}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  backgroundColor: '#1e293b',
                                  color: '#cbd5e1',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                {g.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Observações da sessão (se houver) */}
                    {item.session.notes && (
                      <div
                        data-testid={`${testId}-session-notes-${item.session.id}`}
                        style={{
                          backgroundColor: '#1e293b44',
                          borderLeft: '3px solid #38bdf8',
                          padding: '6px 10px',
                          borderRadius: '0 6px 6px 0',
                          fontSize: 12,
                          color: '#cbd5e1',
                          fontStyle: 'italic',
                        }}
                      >
                        "{item.session.notes}"
                      </div>
                    )}

                    {/* Participantes Presentes */}
                    {item.participants && item.participants.length > 0 && (
                      <div
                        data-testid={`${testId}-participants-${item.session.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          color: '#94a3b8',
                          borderTop: '1px solid #1e293b',
                          paddingTop: 8,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>Presentes:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {item.participants.map((p) => (
                            <span
                              key={p.id}
                              style={{
                                backgroundColor: '#1e293b',
                                color: '#e2e8f0',
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              {p.displayName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div
              data-testid={`${testId}-pagination`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTop: '1px solid #1e293b',
              }}
            >
              <button
                type="button"
                data-testid={`${testId}-prev-page`}
                disabled={currentPage <= 1}
                onClick={handlePrevPage}
                style={{
                  backgroundColor: '#1e293b',
                  color: currentPage <= 1 ? '#64748b' : '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Anterior
              </button>

              <span
                data-testid={`${testId}-page-indicator`}
                style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}
              >
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                data-testid={`${testId}-next-page`}
                disabled={currentPage >= totalPages}
                onClick={handleNextPage}
                style={{
                  backgroundColor: '#1e293b',
                  color: currentPage >= totalPages ? '#64748b' : '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
