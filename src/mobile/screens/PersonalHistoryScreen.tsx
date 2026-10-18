import React, { useState, useMemo } from 'react';
import { Movie, MovieGenre } from '../../core/domain/entities/Movie.js';
import { PreferenceStatus } from '../../core/domain/enums/PreferenceStatus.js';
import { EnrichedUserPreference } from '../../core/services/PreferenceService.js';
import { MovieGridCard } from '../components/Watchlist/MovieGridCard.js';

export interface PersonalHistoryScreenProps {
  readonly items?: readonly EnrichedUserPreference[] | undefined;
  readonly initialMovies?: readonly Movie[] | undefined;
  readonly availableGenres?: readonly MovieGenre[] | undefined;
  readonly isLoading?: boolean | undefined;
  readonly error?: string | null | undefined;
  readonly onToggleStatus?: ((movieId: number, targetStatus: PreferenceStatus) => void | Promise<void>) | undefined;
  readonly onRemove?: ((movieId: number) => void | Promise<void>) | undefined;
  readonly onSelectMovie?: ((movie: Movie) => void) | undefined;
  readonly pageSize?: number | undefined;
  readonly testId?: string | undefined;
}

export function normalizeHistoryItems(
  items?: readonly EnrichedUserPreference[],
  initialMovies?: readonly Movie[],
): readonly EnrichedUserPreference[] {
  if (items && items.length > 0) {
    return items.filter(
      (item) => item.preference.status === PreferenceStatus.ALREADY_WATCHED,
    );
  }
  if (initialMovies && initialMovies.length > 0) {
    return initialMovies.map((movie) => ({
      movie,
      preference: {
        id: `pref-hist-${movie.tmdbId}`,
        userId: 'current-user',
        movieId: movie.tmdbId,
        status: PreferenceStatus.ALREADY_WATCHED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));
  }
  return [];
}

export const PersonalHistoryScreen: React.FC<PersonalHistoryScreenProps> = ({
  items,
  initialMovies,
  availableGenres,
  isLoading = false,
  error = null,
  onToggleStatus,
  onRemove,
  onSelectMovie,
  pageSize = 6,
  testId = 'personal-history-screen',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Normalização de dados recebidos via items ou initialMovies
  const normalizedItems: readonly EnrichedUserPreference[] = useMemo(
    () => normalizeHistoryItems(items, initialMovies),
    [items, initialMovies],
  );

  // Lista única de gêneros cinematográficos
  const genresList: readonly MovieGenre[] = useMemo(() => {
    if (availableGenres && availableGenres.length > 0) {
      return availableGenres;
    }
    const map = new Map<number, MovieGenre>();
    for (const item of normalizedItems) {
      for (const genre of item.movie.genres) {
        if (!map.has(genre.id)) {
          map.set(genre.id, genre);
        }
      }
    }
    return Array.from(map.values());
  }, [availableGenres, normalizedItems]);

  // Filtros combinados de busca e gênero
  const filteredItems = useMemo(() => {
    let result = normalizedItems;

    if (searchTerm.trim().length > 0) {
      const query = searchTerm.trim().toLowerCase();
      result = result.filter((item) =>
        item.movie.title.toLowerCase().includes(query),
      );
    }

    if (selectedGenreId !== null) {
      result = result.filter((item) =>
        item.movie.genres.some((genre) => genre.id === selectedGenreId),
      );
    }

    return result;
  }, [normalizedItems, searchTerm, selectedGenreId]);

  // Paginação determinística
  const totalResults = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (activePage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, activePage, pageSize]);

  const handleToggle = async (movieId: number, targetStatus: PreferenceStatus) => {
    const targetItem = normalizedItems.find((i) => i.movie.tmdbId === movieId);
    const title = targetItem?.movie.title ?? 'Filme';
    await onToggleStatus?.(movieId, targetStatus);
    setToastMessage(`"${title}" movido para sua watchlist!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRemove = async (movieId: number) => {
    const targetItem = normalizedItems.find((i) => i.movie.tmdbId === movieId);
    const title = targetItem?.movie.title ?? 'Filme';
    await onRemove?.(movieId);
    setToastMessage(`"${title}" removido do seu histórico.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedGenreId(null);
    setCurrentPage(1);
  };

  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: 720,
        margin: '0 auto',
        padding: '24px 16px',
        backgroundColor: '#0f172a',
        minHeight: '100vh',
        boxSizing: 'border-box',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Toast Informativo Não Intrusivo */}
      {toastMessage && (
        <div
          data-testid="history-toast"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 20px',
            borderRadius: 12,
            backgroundColor: '#6366f1',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: 14,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
            zIndex: 100,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Cabeçalho */}
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1
              data-testid="history-title"
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: -0.5,
              }}
            >
              Filmes Assistidos
            </h1>
            <p
              data-testid="history-count"
              style={{
                margin: '4px 0 0 0',
                fontSize: 14,
                color: '#94a3b8',
              }}
            >
              {normalizedItems.length} {normalizedItems.length === 1 ? 'filme assistido' : 'filmes assistidos'}
            </p>
          </div>

          <div
            data-testid="history-privacy-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 20,
              backgroundColor: '#1e293b',
              fontSize: 12,
              fontWeight: 600,
              color: '#818cf8',
              border: '1px solid #334155',
            }}
          >
            <span>👁️</span>
            <span>Histórico Pessoal</span>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div style={{ marginTop: 16 }}>
          <input
            type="text"
            data-testid="history-search-input"
            placeholder="Buscar nos filmes assistidos..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              fontSize: 14,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Chips de Gênero */}
        {genresList.length > 0 && (
          <div
            data-testid="history-genre-filters"
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingTop: 12,
              paddingBottom: 4,
            }}
          >
            <button
              type="button"
              data-testid="history-genre-filter-all"
              onClick={() => {
                setSelectedGenreId(null);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: selectedGenreId === null ? '#6366f1' : '#1e293b',
                color: selectedGenreId === null ? '#ffffff' : '#94a3b8',
                whiteSpace: 'nowrap',
              }}
            >
              Todos
            </button>
            {genresList.map((genre) => {
              const isSelected = selectedGenreId === genre.id;
              return (
                <button
                  key={genre.id}
                  type="button"
                  data-testid={`history-genre-filter-${genre.id}`}
                  onClick={() => {
                    setSelectedGenreId(isSelected ? null : genre.id);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: isSelected ? '#6366f1' : '#1e293b',
                    color: isSelected ? '#ffffff' : '#94a3b8',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Estados de Carregamento e Erro */}
      {isLoading && (
        <div
          data-testid="history-loading"
          style={{
            padding: 48,
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: 14,
          }}
        >
          Carregando histórico de filmes assistidos...
        </div>
      )}

      {error && (
        <div
          data-testid="history-error"
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Lista Vazia / Empty State */}
      {!isLoading && filteredItems.length === 0 && (
        <div
          data-testid="history-empty-state"
          style={{
            padding: '64px 24px',
            textAlign: 'center',
            backgroundColor: '#1e293b',
            borderRadius: 16,
            marginTop: 24,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍿</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>
            {normalizedItems.length === 0
              ? 'Nenhum filme no histórico'
              : 'Nenhum filme corresponde aos filtros'}
          </h2>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 16px 0', maxWidth: 360, marginInline: 'auto' }}>
            {normalizedItems.length === 0
              ? 'Marque filmes que você já assistiu pelo botão central do deck de swipes ou mova-os da sua watchlist.'
              : 'Tente alterar a busca textual ou o filtro de gênero cinematográfico.'}
          </p>
          {normalizedItems.length > 0 && (
            <button
              type="button"
              data-testid="btn-history-clear-filters"
              onClick={clearFilters}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: '#6366f1',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Limpar Filtros
            </button>
          )}
        </div>
      )}

      {/* Grade de Filmes */}
      {!isLoading && filteredItems.length > 0 && (
        <main
          data-testid="history-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 16,
            marginTop: 8,
          }}
        >
          {paginatedItems.map((item) => (
            <MovieGridCard
              key={item.movie.tmdbId}
              movie={item.movie}
              preferenceStatus={item.preference.status}
              onToggleStatus={handleToggle}
              onRemove={handleRemove}
              onPress={onSelectMovie}
            />
          ))}
        </main>
      )}

      {/* Controles de Paginação */}
      {!isLoading && totalPages > 1 && (
        <footer
          data-testid="history-pagination"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            marginTop: 32,
            paddingTop: 16,
            borderTop: '1px solid #1e293b',
          }}
        >
          <button
            type="button"
            data-testid="btn-history-prev-page"
            disabled={activePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #334155',
              backgroundColor: activePage <= 1 ? '#0f172a' : '#1e293b',
              color: activePage <= 1 ? '#475569' : '#f8fafc',
              cursor: activePage <= 1 ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Anterior
          </button>

          <span
            data-testid="history-pagination-indicator"
            style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}
          >
            Página {activePage} de {totalPages}
          </span>

          <button
            type="button"
            data-testid="btn-history-next-page"
            disabled={activePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #334155',
              backgroundColor: activePage >= totalPages ? '#0f172a' : '#1e293b',
              color: activePage >= totalPages ? '#475569' : '#f8fafc',
              cursor: activePage >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Próxima
          </button>
        </footer>
      )}
    </div>
  );
};
