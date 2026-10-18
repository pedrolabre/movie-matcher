import React, { useState, useMemo } from 'react';
import { Movie, MovieGenre } from '../../core/domain/entities/Movie.js';
import { PreferenceStatus } from '../../core/domain/enums/PreferenceStatus.js';
import { EnrichedUserPreference } from '../../core/services/PreferenceService.js';
import { MovieGridCard } from '../components/Watchlist/MovieGridCard.js';

export interface PersonalWatchlistScreenProps {
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

export function normalizeWatchlistItems(
  items?: readonly EnrichedUserPreference[],
  initialMovies?: readonly Movie[],
): readonly EnrichedUserPreference[] {
  if (items && items.length > 0) {
    return items.filter(
      (item) => item.preference.status === PreferenceStatus.WANT_TO_WATCH,
    );
  }
  if (initialMovies && initialMovies.length > 0) {
    return initialMovies.map((movie) => ({
      movie,
      preference: {
        id: `pref-${movie.tmdbId}`,
        userId: 'current-user',
        movieId: movie.tmdbId,
        status: PreferenceStatus.WANT_TO_WATCH,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));
  }
  return [];
}

export function filterUserListItems(
  items: readonly EnrichedUserPreference[],
  options?: { searchTerm?: string; genreId?: number | null },
): readonly EnrichedUserPreference[] {
  let result = items;
  if (options?.searchTerm && options.searchTerm.trim().length > 0) {
    const query = options.searchTerm.trim().toLowerCase();
    result = result.filter((item) =>
      item.movie.title.toLowerCase().includes(query),
    );
  }
  if (typeof options?.genreId === 'number') {
    result = result.filter((item) =>
      item.movie.genres.some((genre) => genre.id === options.genreId),
    );
  }
  return result;
}

export function paginateUserListItems(
  items: readonly EnrichedUserPreference[],
  page: number,
  pageSize: number,
): {
  readonly paginatedItems: readonly EnrichedUserPreference[];
  readonly totalPages: number;
  readonly activePage: number;
} {
  const totalResults = items.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const activePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);
  return { paginatedItems, totalPages, activePage };
}

export function extractGenresFromItems(
  items: readonly EnrichedUserPreference[],
  availableGenres?: readonly MovieGenre[],
): readonly MovieGenre[] {
  if (availableGenres && availableGenres.length > 0) {
    return availableGenres;
  }
  const map = new Map<number, MovieGenre>();
  for (const item of items) {
    for (const genre of item.movie.genres) {
      if (!map.has(genre.id)) {
        map.set(genre.id, genre);
      }
    }
  }
  return Array.from(map.values());
}

export const PersonalWatchlistScreen: React.FC<PersonalWatchlistScreenProps> = ({
  items,
  initialMovies,
  availableGenres,
  isLoading = false,
  error = null,
  onToggleStatus,
  onRemove,
  onSelectMovie,
  pageSize = 6,
  testId = 'personal-watchlist-screen',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Normalização de dados recebidos via items ou initialMovies
  const normalizedItems: readonly EnrichedUserPreference[] = useMemo(
    () => normalizeWatchlistItems(items, initialMovies),
    [items, initialMovies],
  );

  // Lista única de gêneros cinematográficos
  const genresList: readonly MovieGenre[] = useMemo(
    () => extractGenresFromItems(normalizedItems, availableGenres),
    [availableGenres, normalizedItems],
  );

  // Filtros combinados de busca e gênero
  const filteredItems = useMemo(
    () => filterUserListItems(normalizedItems, { searchTerm, genreId: selectedGenreId }),
    [normalizedItems, searchTerm, selectedGenreId],
  );

  // Paginação determinística
  const { paginatedItems, totalPages, activePage } = useMemo(
    () => paginateUserListItems(filteredItems, currentPage, pageSize),
    [filteredItems, currentPage, pageSize],
  );

  const handleToggle = async (movieId: number, targetStatus: PreferenceStatus) => {
    const targetItem = normalizedItems.find((i) => i.movie.tmdbId === movieId);
    const title = targetItem?.movie.title ?? 'Filme';
    await onToggleStatus?.(movieId, targetStatus);
    setToastMessage(`"${title}" marcado como assistido!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRemove = async (movieId: number) => {
    const targetItem = normalizedItems.find((i) => i.movie.tmdbId === movieId);
    const title = targetItem?.movie.title ?? 'Filme';
    await onRemove?.(movieId);
    setToastMessage(`"${title}" removido da sua watchlist.`);
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
          data-testid="watchlist-toast"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 20px',
            borderRadius: 12,
            backgroundColor: '#22c55e',
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
              data-testid="watchlist-title"
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: -0.5,
              }}
            >
              Minha Watchlist
            </h1>
            <p
              data-testid="watchlist-count"
              style={{
                margin: '4px 0 0 0',
                fontSize: 14,
                color: '#94a3b8',
              }}
            >
              {normalizedItems.length} {normalizedItems.length === 1 ? 'filme salvo' : 'filmes salvos'}
            </p>
          </div>

          <div
            data-testid="privacy-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 20,
              backgroundColor: '#1e293b',
              fontSize: 12,
              fontWeight: 600,
              color: '#38bdf8',
              border: '1px solid #334155',
            }}
          >
            <span>🔒</span>
            <span>Lista Privada</span>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div style={{ marginTop: 16 }}>
          <input
            type="text"
            data-testid="watchlist-search-input"
            placeholder="Buscar filme por título..."
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
            data-testid="watchlist-genre-filters"
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
              data-testid="genre-filter-all"
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
                backgroundColor: selectedGenreId === null ? '#38bdf8' : '#1e293b',
                color: selectedGenreId === null ? '#0f172a' : '#94a3b8',
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
                  data-testid={`genre-filter-${genre.id}`}
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
                    backgroundColor: isSelected ? '#38bdf8' : '#1e293b',
                    color: isSelected ? '#0f172a' : '#94a3b8',
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
          data-testid="watchlist-loading"
          style={{
            padding: 48,
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: 14,
          }}
        >
          Carregando sua watchlist pessoal...
        </div>
      )}

      {error && (
        <div
          data-testid="watchlist-error"
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
          data-testid="watchlist-empty-state"
          style={{
            padding: '64px 24px',
            textAlign: 'center',
            backgroundColor: '#1e293b',
            borderRadius: 16,
            marginTop: 24,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>
            {normalizedItems.length === 0
              ? 'Sua watchlist está vazia'
              : 'Nenhum filme corresponde aos filtros'}
          </h2>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 16px 0', maxWidth: 360, marginInline: 'auto' }}>
            {normalizedItems.length === 0
              ? 'Explore os filmes em cartaz e deslize para a direita no deck de swipes para salvar seus favoritos.'
              : 'Tente alterar a busca textual ou o filtro de gênero cinematográfico.'}
          </p>
          {normalizedItems.length > 0 && (
            <button
              type="button"
              data-testid="btn-clear-filters"
              onClick={clearFilters}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: '#38bdf8',
                color: '#0f172a',
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
          data-testid="watchlist-grid"
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
          data-testid="watchlist-pagination"
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
            data-testid="btn-prev-page"
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
            data-testid="pagination-indicator"
            style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}
          >
            Página {activePage} de {totalPages}
          </span>

          <button
            type="button"
            data-testid="btn-next-page"
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
