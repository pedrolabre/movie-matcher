import React from 'react';
import { Movie } from '../../../core/domain/entities/Movie.js';
import { PreferenceStatus } from '../../../core/domain/enums/PreferenceStatus.js';

export interface MovieGridCardProps {
  readonly movie: Movie;
  readonly preferenceStatus?: PreferenceStatus | null | undefined;
  readonly onToggleStatus?: ((movieId: number, targetStatus: PreferenceStatus) => void | Promise<void>) | undefined;
  readonly onRemove?: ((movieId: number) => void | Promise<void>) | undefined;
  readonly onPress?: ((movie: Movie) => void) | undefined;
  readonly showActions?: boolean | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly testId?: string | undefined;
}

const DEFAULT_POSTER_FALLBACK =
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80';

export const MovieGridCard: React.FC<MovieGridCardProps> = ({
  movie,
  preferenceStatus = PreferenceStatus.WANT_TO_WATCH,
  onToggleStatus,
  onRemove,
  onPress,
  showActions = true,
  style,
  testId = 'movie-grid-card',
}) => {
  const posterSource = movie.posterPath ?? DEFAULT_POSTER_FALLBACK;
  const ratingText =
    typeof movie.voteAverage === 'number' && movie.voteAverage > 0
      ? movie.voteAverage.toFixed(1)
      : 'N/A';

  const isWatchlist = preferenceStatus === PreferenceStatus.WANT_TO_WATCH;
  const isHistory = preferenceStatus === PreferenceStatus.ALREADY_WATCHED;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleStatus) return;
    const nextStatus = isWatchlist
      ? PreferenceStatus.ALREADY_WATCHED
      : PreferenceStatus.WANT_TO_WATCH;
    onToggleStatus(movie.tmdbId, nextStatus);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(movie.tmdbId);
  };

  const handleCardClick = () => {
    onPress?.(movie);
  };

  return (
    <div
      data-testid={testId}
      data-movie-id={movie.tmdbId}
      aria-label={`Card de ${movie.title}`}
      onClick={handleCardClick}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1e293b',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
        cursor: onPress ? 'pointer' : 'default',
        color: '#ffffff',
        width: '100%',
        maxWidth: 240,
        ...style,
      }}
    >
      {/* Pôster com overlays */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 240,
          backgroundColor: '#0f172a',
          overflow: 'hidden',
        }}
      >
        <img
          src={posterSource}
          alt={movie.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* Badge de Nota */}
        <div
          data-testid="grid-card-rating"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 8,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            fontSize: 12,
            fontWeight: 700,
            color: '#fbbf24',
          }}
        >
          <span>★</span>
          <span>{ratingText}</span>
        </div>

        {/* Badge de Ano */}
        {typeof movie.releaseYear === 'number' && (
          <div
            data-testid="grid-card-year"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '4px 8px',
              borderRadius: 8,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(4px)',
              fontSize: 12,
              fontWeight: 600,
              color: '#cbd5e1',
            }}
          >
            {movie.releaseYear}
          </div>
        )}

        {/* Badge de Status */}
        {preferenceStatus && (
          <div
            data-testid={`grid-card-status-${preferenceStatus.toLowerCase()}`}
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              backgroundColor: isWatchlist
                ? 'rgba(34, 197, 94, 0.9)'
                : isHistory
                  ? 'rgba(99, 102, 241, 0.9)'
                  : 'rgba(100, 116, 139, 0.9)',
              color: '#ffffff',
            }}
          >
            {isWatchlist ? 'Quero Assistir' : isHistory ? 'Já Assisti' : preferenceStatus}
          </div>
        )}
      </div>

      {/* Conteúdo Informativo */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          padding: 12,
          gap: 8,
        }}
      >
        <h3
          data-testid="grid-card-title"
          title={movie.title}
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.3,
            color: '#f8fafc',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {movie.title}
        </h3>

        {/* Chips de Gênero */}
        {movie.genres && movie.genres.length > 0 && (
          <div
            data-testid="grid-card-genres"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              overflow: 'hidden',
              maxHeight: 22,
            }}
          >
            {movie.genres.slice(0, 2).map((genre) => (
              <span
                key={genre.id}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: '#334155',
                  color: '#94a3b8',
                }}
              >
                {genre.name}
              </span>
            ))}
          </div>
        )}

        {/* Ações Rápidas */}
        {showActions && (
          <div
            data-testid="grid-card-actions"
            style={{
              marginTop: 'auto',
              display: 'flex',
              gap: 6,
              paddingTop: 8,
              borderTop: '1px solid #334155',
            }}
          >
            <button
              type="button"
              data-testid="btn-toggle-status"
              onClick={handleToggle}
              title={isWatchlist ? 'Marcar como Já Assisti' : 'Mover para Quero Assistir'}
              style={{
                flexGrow: 1,
                padding: '6px 8px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: isWatchlist ? '#6366f1' : '#22c55e',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span>{isWatchlist ? '✓ Já Assisti' : '+ Watchlist'}</span>
            </button>

            <button
              type="button"
              data-testid="btn-remove-item"
              onClick={handleRemove}
              title="Remover título"
              style={{
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #475569',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
