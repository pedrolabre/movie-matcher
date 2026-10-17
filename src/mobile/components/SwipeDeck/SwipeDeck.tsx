import React, { useEffect, useCallback } from 'react';
import { Movie } from '../../../core/domain/entities/Movie.js';
import { useDeckStore } from '../../stores/useDeckStore.js';
import { useSwipeGesture } from './useSwipeGesture.js';
import { MovieCard } from './MovieCard.js';

export interface SwipeDeckProps {
  readonly initialMovies?: readonly Movie[];
  readonly onSwipeRight?: (movie: Movie) => void;
  readonly onSwipeLeft?: (movie: Movie) => void;
  readonly onAlreadyWatched?: (movie: Movie) => void;
  readonly onEmptyQueue?: () => void;
  readonly testId?: string;
}

export const SwipeDeck: React.FC<SwipeDeckProps> = ({
  initialMovies,
  onSwipeRight,
  onSwipeLeft,
  onAlreadyWatched,
  onEmptyQueue,
  testId = 'swipe-deck',
}) => {
  const activeMovie = useDeckStore((state) => state.activeMovie);
  const queue = useDeckStore((state) => state.queue);
  const isEmpty = useDeckStore((state) => state.isEmpty);
  const isLoading = useDeckStore((state) => state.isLoading);
  const setQueue = useDeckStore((state) => state.setQueue);
  const storeSwipeRight = useDeckStore((state) => state.swipeRight);
  const storeSwipeLeft = useDeckStore((state) => state.swipeLeft);
  const storeMarkAlreadyWatched = useDeckStore((state) => state.markAlreadyWatched);

  useEffect(() => {
    if (initialMovies && initialMovies.length > 0 && isEmpty) {
      setQueue(initialMovies);
    }
  }, [initialMovies, isEmpty, setQueue]);

  useEffect(() => {
    if (isEmpty && !isLoading) {
      onEmptyQueue?.();
    }
  }, [isEmpty, isLoading, onEmptyQueue]);

  const handleSwipeRightComplete = useCallback(async () => {
    if (!activeMovie) {
      return;
    }
    const current = activeMovie;
    await storeSwipeRight();
    onSwipeRight?.(current);
  }, [activeMovie, storeSwipeRight, onSwipeRight]);

  const handleSwipeLeftComplete = useCallback(async () => {
    if (!activeMovie) {
      return;
    }
    const current = activeMovie;
    await storeSwipeLeft();
    onSwipeLeft?.(current);
  }, [activeMovie, storeSwipeLeft, onSwipeLeft]);

  const {
    translationX,
    translationY,
    rotation,
    opacity,
    triggerSwipe,
    resetPosition,
  } = useSwipeGesture({
    onSwipeRight: () => {
      void handleSwipeRightComplete();
    },
    onSwipeLeft: () => {
      void handleSwipeLeftComplete();
    },
  });

  useEffect(() => {
    resetPosition();
  }, [activeMovie?.tmdbId, resetPosition]);

  const handleManualSkip = () => {
    triggerSwipe('left');
  };

  const handleManualLike = () => {
    triggerSwipe('right');
  };

  const handleManualAlreadyWatched = async () => {
    if (!activeMovie) {
      return;
    }
    const current = activeMovie;
    await storeMarkAlreadyWatched();
    onAlreadyWatched?.(current);
  };

  const nextMovie = queue[0] ?? null;

  let currentBadge: 'WANT_TO_WATCH' | 'SKIPPED' | null = null;
  if (translationX >= 60) {
    currentBadge = 'WANT_TO_WATCH';
  } else if (translationX <= -60) {
    currentBadge = 'SKIPPED';
  }

  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: 420,
        margin: '0 auto',
        padding: '16px 12px',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-testid="deck-viewport"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 380,
          height: 560,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isLoading && (
          <div
            data-testid="deck-loading"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 480,
              color: '#a1a1aa',
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            Carregando catálogo de filmes...
          </div>
        )}

        {!isLoading && isEmpty && (
          <div
            data-testid="deck-empty"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '32px 24px',
              backgroundColor: '#18181b',
              borderRadius: 24,
              border: '1px solid #27272a',
              width: '100%',
              maxWidth: 340,
              color: '#ffffff',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700 }}>
              Fim das Recomendações
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: '#a1a1aa', lineHeight: 1.5 }}>
              Você já avaliou todos os filmes da fila atual! Volte mais tarde ou explore outros gêneros no catálogo.
            </p>
          </div>
        )}

        {!isLoading && activeMovie && (
          <>
            {nextMovie && (
              <div
                data-testid="deck-background-card"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 1,
                  transform: 'scale(0.95) translateY(12px)',
                  opacity: 0.85,
                  pointerEvents: 'none',
                }}
              >
                <MovieCard movie={nextMovie} isTop={false} testId="movie-card-next" />
              </div>
            )}

            <div
              data-testid="deck-active-card-container"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 2,
                transform: `translate3d(${translationX}px, ${translationY}px, 0) rotate(${rotation}deg)`,
                opacity,
                transition: translationX === 0 ? 'transform 0.25s ease-out' : 'none',
              }}
            >
              <MovieCard
                movie={activeMovie}
                isTop={true}
                overlayBadge={currentBadge}
                testId="movie-card-active"
              />
            </div>
          </>
        )}
      </div>

      <div
        data-testid="deck-controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          marginTop: 24,
          width: '100%',
        }}
      >
        <button
          type="button"
          data-testid="btn-skip"
          aria-label="Pular filme"
          onClick={handleManualSkip}
          disabled={isEmpty || isLoading}
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            backgroundColor: '#27272a',
            border: '2px solid #ef4444',
            color: '#ef4444',
            fontSize: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isEmpty || isLoading ? 'not-allowed' : 'pointer',
            opacity: isEmpty || isLoading ? 0.4 : 1,
            transition: 'transform 0.15s ease, background-color 0.15s ease',
          }}
        >
          ✕
        </button>

        <button
          type="button"
          data-testid="btn-already-watched"
          aria-label="Já assisti este filme"
          onClick={handleManualAlreadyWatched}
          disabled={isEmpty || isLoading}
          style={{
            height: 46,
            padding: '0 18px',
            borderRadius: 23,
            backgroundColor: '#27272a',
            border: '2px solid #3b82f6',
            color: '#3b82f6',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: isEmpty || isLoading ? 'not-allowed' : 'pointer',
            opacity: isEmpty || isLoading ? 0.4 : 1,
            transition: 'transform 0.15s ease, background-color 0.15s ease',
          }}
        >
          <span>👁️</span>
          <span>Já Assisti</span>
        </button>

        <button
          type="button"
          data-testid="btn-want-to-watch"
          aria-label="Quero assistir"
          onClick={handleManualLike}
          disabled={isEmpty || isLoading}
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            backgroundColor: '#27272a',
            border: '2px solid #22c55e',
            color: '#22c55e',
            fontSize: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isEmpty || isLoading ? 'not-allowed' : 'pointer',
            opacity: isEmpty || isLoading ? 0.4 : 1,
            transition: 'transform 0.15s ease, background-color 0.15s ease',
          }}
        >
          ♥
        </button>
      </div>
    </div>
  );
};
