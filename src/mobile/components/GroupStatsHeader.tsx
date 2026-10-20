import React from 'react';
import { GroupGenreStat, GroupStats } from '../../core/domain/types/schemas.js';

export interface GroupStatsHeaderProps {
  readonly stats: GroupStats;
  readonly groupName?: string | undefined;
  readonly onGenreClick?: ((genre: GroupGenreStat) => void) | undefined;
  readonly selectedGenreId?: number | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly testId?: string | undefined;
}

export function formatComplicityMessage(totalMovies: number): string {
  if (totalMovies === 0) {
    return 'Nenhum filme assistido juntos ainda';
  }
  if (totalMovies === 1) {
    return 'Vocês já assistiram 1 filme juntos';
  }
  return `Vocês já assistiram ${totalMovies} filmes juntos`;
}

export function formatRuntimeMessage(minutes: number): string {
  if (minutes <= 0) {
    return '0 min de cinema compartilhado';
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m de cinema compartilhado`;
  }
  if (hours > 0) {
    return `${hours}h de cinema compartilhado`;
  }
  return `${mins}m de cinema compartilhado`;
}

export function formatGenrePillText(genre: GroupGenreStat): string {
  return `${genre.name} (${genre.count})`;
}

export const GroupStatsHeader: React.FC<GroupStatsHeaderProps> = ({
  stats,
  groupName,
  onGenreClick,
  selectedGenreId,
  style,
  testId = 'group-stats-header',
}) => {
  const hasMovies = stats.totalMoviesWatched > 0;
  const complicityText = formatComplicityMessage(stats.totalMoviesWatched);
  const runtimeText = formatRuntimeMessage(stats.totalRuntimeMinutes);

  return (
    <div
      data-testid={testId}
      style={{
        backgroundColor: '#0f172a',
        borderRadius: 20,
        padding: '24px 20px',
        border: '1px solid #1e293b',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        ...style,
      }}
    >
      {/* Etiqueta superior */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: '#a855f7',
            backgroundColor: '#a855f718',
            padding: '4px 10px',
            borderRadius: 999,
            border: '1px solid #a855f733',
          }}
        >
          Memória Afetiva & Cumplicidade
        </span>
        {groupName && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#94a3b8',
            }}
          >
            {groupName}
          </span>
        )}
      </div>

      {/* Título Principal & Métrica de Tempo */}
      <div>
        <h2
          data-testid={`${testId}-complicity-title`}
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#f8fafc',
            margin: '0 0 6px 0',
            lineHeight: 1.25,
          }}
        >
          {complicityText}
        </h2>

        {hasMovies ? (
          <p
            data-testid={`${testId}-runtime-text`}
            style={{
              fontSize: 14,
              color: '#38bdf8',
              fontWeight: 600,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>⏱️</span>
            {runtimeText}
          </p>
        ) : (
          <p
            data-testid={`${testId}-empty-hint`}
            style={{
              fontSize: 13,
              color: '#64748b',
              margin: 0,
            }}
          >
            Agendem uma sessão consensual e marquem como assistido para acumular a história do grupo!
          </p>
        )}
      </div>

      {/* Pílulas de Gêneros Mais Frequentes */}
      {stats.topGenres.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Gêneros Favoritos do Grupo
          </span>
          <div
            data-testid={`${testId}-genres-list`}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {stats.topGenres.map((genre) => {
              const isSelected = selectedGenreId === genre.id;
              return (
                <button
                  key={genre.id}
                  type="button"
                  data-testid={`${testId}-genre-pill-${genre.id}`}
                  onClick={() => onGenreClick?.(genre)}
                  style={{
                    backgroundColor: isSelected ? '#a855f7' : '#1e293b',
                    color: isSelected ? '#ffffff' : '#cbd5e1',
                    border: isSelected ? '1px solid #c084fc' : '1px solid #334155',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: onGenreClick ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{formatGenrePillText(genre)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
