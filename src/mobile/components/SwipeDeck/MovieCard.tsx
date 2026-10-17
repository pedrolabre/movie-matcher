import React from 'react';
import { Movie } from '../../../core/domain/entities/Movie.js';

export interface MovieCardProps {
  readonly movie: Movie;
  readonly isTop?: boolean;
  readonly overlayBadge?: 'WANT_TO_WATCH' | 'SKIPPED' | 'ALREADY_WATCHED' | null;
  readonly style?: React.CSSProperties;
  readonly testId?: string;
}

const DEFAULT_POSTER_FALLBACK =
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80';

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  isTop = true,
  overlayBadge = null,
  style,
  testId = 'movie-card',
}) => {
  const posterSource = movie.posterPath ?? DEFAULT_POSTER_FALLBACK;
  const ratingText =
    typeof movie.voteAverage === 'number'
      ? movie.voteAverage.toFixed(1)
      : 'N/A';
  const durationText =
    typeof movie.runtimeMinutes === 'number' && movie.runtimeMinutes > 0
      ? `${movie.runtimeMinutes} min`
      : null;

  return (
    <div
      data-testid={testId}
      aria-label={`Filme: ${movie.title}`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 380,
        height: 560,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#18181b',
        boxShadow: isTop
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)'
          : '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        color: '#ffffff',
        ...style,
      }}
    >
      <img
        src={posterSource}
        alt={movie.title}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
        }}
      />

      {overlayBadge === 'WANT_TO_WATCH' && (
        <div
          data-testid="badge-want-to-watch"
          style={{
            position: 'absolute',
            top: 28,
            right: 28,
            padding: '8px 16px',
            border: '3px solid #22c55e',
            borderRadius: 12,
            backgroundColor: 'rgba(34, 197, 94, 0.25)',
            color: '#22c55e',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 1.5,
            transform: 'rotate(12deg)',
            zIndex: 10,
          }}
        >
          QUERO ASSISTIR
        </div>
      )}

      {overlayBadge === 'SKIPPED' && (
        <div
          data-testid="badge-skipped"
          style={{
            position: 'absolute',
            top: 28,
            left: 28,
            padding: '8px 16px',
            border: '3px solid #ef4444',
            borderRadius: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 1.5,
            transform: 'rotate(-12deg)',
            zIndex: 10,
          }}
        >
          PULAR
        </div>
      )}

      {overlayBadge === 'ALREADY_WATCHED' && (
        <div
          data-testid="badge-already-watched"
          style={{
            position: 'absolute',
            top: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            border: '3px solid #3b82f6',
            borderRadius: 12,
            backgroundColor: 'rgba(59, 130, 246, 0.25)',
            color: '#3b82f6',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 1.5,
            zIndex: 10,
          }}
        >
          JÁ ASSISTI
        </div>
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 5,
          padding: '24px 20px',
          background:
            'linear-gradient(to top, rgba(9, 9, 11, 0.95) 0%, rgba(9, 9, 11, 0.75) 60%, transparent 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <h2
            data-testid="movie-title"
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.25,
              textShadow: '0 2px 4px rgba(0,0,0,0.6)',
            }}
          >
            {movie.title}
          </h2>

          <div
            data-testid="movie-rating"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              padding: '4px 8px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            <span>★</span>
            <span>{ratingText}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#a1a1aa' }}>
          {movie.releaseYear && <span data-testid="movie-year">{movie.releaseYear}</span>}
          {movie.releaseYear && durationText && <span>•</span>}
          {durationText && <span data-testid="movie-runtime">{durationText}</span>}
        </div>

        {movie.genres.length > 0 && (
          <div
            data-testid="movie-genres"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}
          >
            {movie.genres.slice(0, 3).map((genre) => (
              <span
                key={genre.id}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#e4e4e7',
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                {genre.name}
              </span>
            ))}
          </div>
        )}

        {movie.overview && (
          <p
            data-testid="movie-overview"
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.45,
              color: '#d4d4d8',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {movie.overview}
          </p>
        )}
      </div>
    </div>
  );
};
