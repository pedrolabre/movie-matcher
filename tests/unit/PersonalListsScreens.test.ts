import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import {
  PersonalWatchlistScreen,
  normalizeWatchlistItems,
  filterUserListItems,
  paginateUserListItems,
  extractGenresFromItems,
} from '../../src/mobile/screens/PersonalWatchlistScreen.js';
import {
  PersonalHistoryScreen,
  normalizeHistoryItems,
} from '../../src/mobile/screens/PersonalHistoryScreen.js';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';
import { EnrichedUserPreference } from '../../src/core/services/PreferenceService.js';

// Configura dispatcher minimo para execucao de hooks em ambiente puro de Node.js no Vitest
beforeAll(() => {
  const internals =
    (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  if (internals) {
    internals.H = {
      useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useMemo: (factory: any) => factory(),
      useCallback: (fn: any) => fn,
      useEffect: () => {},
    };
  }
});

function createMockMovie(id: number, title: string, genreId = 28, genreName = 'Ação'): Movie {
  return {
    tmdbId: id,
    title,
    originalTitle: title,
    overview: `Sinopse de ${title}`,
    posterPath: `/poster-${id}.jpg`,
    backdropPath: `/backdrop-${id}.jpg`,
    releaseYear: 2024,
    runtimeMinutes: 120,
    voteAverage: 8.0,
    genres: [{ id: genreId, name: genreName }],
    streamingProviders: [],
    syncedAt: new Date(),
  };
}

function createEnrichedItem(
  movie: Movie,
  status: PreferenceStatus = PreferenceStatus.WANT_TO_WATCH,
): EnrichedUserPreference {
  return {
    movie,
    preference: {
      id: `pref-${movie.tmdbId}`,
      userId: 'test-user',
      movieId: movie.tmdbId,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe('PersonalWatchlistScreen Unit Tests', () => {
  it('deve normalizar e filtrar itens da watchlist isolando rejeicoes e historico', () => {
    const movies = [
      createMockMovie(1, 'Duna', 878, 'Ficção Científica'),
      createMockMovie(2, 'Interestelar', 878, 'Ficção Científica'),
      createMockMovie(3, 'Matrix', 878, 'Ficção Científica'),
    ];
    const items = [
      createEnrichedItem(movies[0]!, PreferenceStatus.WANT_TO_WATCH),
      createEnrichedItem(movies[1]!, PreferenceStatus.WANT_TO_WATCH),
      createEnrichedItem(movies[2]!, PreferenceStatus.ALREADY_WATCHED),
    ];

    const normalized = normalizeWatchlistItems(items);
    expect(normalized).toHaveLength(2);
    expect(normalized.every((i) => i.preference.status === PreferenceStatus.WANT_TO_WATCH)).toBe(true);

    const filtered = filterUserListItems(normalized, { searchTerm: 'duna' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.movie.title).toBe('Duna');

    const genres = extractGenresFromItems(normalized);
    expect(genres).toHaveLength(1);
    expect(genres[0]?.name).toBe('Ficção Científica');

    const { paginatedItems, totalPages, activePage } = paginateUserListItems(normalized, 1, 1);
    expect(paginatedItems).toHaveLength(1);
    expect(totalPages).toBe(2);
    expect(activePage).toBe(1);
  });

  it('deve renderizar cabecalho, contagem, selo de privacidade e grade de filmes', () => {
    const movies = [
      createMockMovie(1, 'Duna', 878, 'Ficção Científica'),
      createMockMovie(2, 'Interestelar', 878, 'Ficção Científica'),
    ];
    const items = movies.map((m) => createEnrichedItem(m, PreferenceStatus.WANT_TO_WATCH));

    const element = PersonalWatchlistScreen({ items }) as React.ReactElement<any>;
    expect(element).toBeDefined();
    expect(element.props['data-testid']).toBe('personal-watchlist-screen');

    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const header = children.find((c) => c && c.type === 'header');
    expect(header).toBeDefined();

    const headerChildren = React.Children.toArray(header?.props.children) as React.ReactElement<any>[];
    const topRow = headerChildren[0];
    const topRowChildren = React.Children.toArray(topRow?.props.children) as React.ReactElement<any>[];

    const titlesCol = topRowChildren[0];
    const titleChildren = React.Children.toArray(titlesCol?.props.children) as React.ReactElement<any>[];
    const titleEl = titleChildren.find((c) => c.props['data-testid'] === 'watchlist-title');
    expect(titleEl?.props.children).toBe('Minha Watchlist');

    const countEl = titleChildren.find((c) => c.props['data-testid'] === 'watchlist-count');
    expect(countEl?.props.children).toEqual([2, ' ', 'filmes salvos']);

    const privacyBadge = topRowChildren.find((c) => c.props['data-testid'] === 'privacy-badge');
    expect(privacyBadge).toBeDefined();
  });

  it('deve renderizar estado de loading quando isLoading for verdadeiro', () => {
    const element = PersonalWatchlistScreen({ isLoading: true }) as React.ReactElement<any>;
    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const loadingEl = children.find((c) => c && c.props && c.props['data-testid'] === 'watchlist-loading');
    expect(loadingEl).toBeDefined();
  });

  it('deve renderizar estado de erro quando houver mensagem de erro', () => {
    const element = PersonalWatchlistScreen({ error: 'Falha na conexão' }) as React.ReactElement<any>;
    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const errorEl = children.find((c) => c && c.props && c.props['data-testid'] === 'watchlist-error');
    expect(errorEl).toBeDefined();
    expect(errorEl?.props.children).toBe('Falha na conexão');
  });

  it('deve renderizar empty state quando a lista estiver vazia', () => {
    const element = PersonalWatchlistScreen({ items: [] }) as React.ReactElement<any>;
    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const emptyState = children.find(
      (c) => c && c.props && c.props['data-testid'] === 'watchlist-empty-state',
    );
    expect(emptyState).toBeDefined();
  });

  it('deve filtrar itens apenas com status WANT_TO_WATCH ignorando SKIPPED ou ALREADY_WATCHED', () => {
    const movie1 = createMockMovie(1, 'Watchlist Movie');
    const movie2 = createMockMovie(2, 'Watched Movie');
    const items = [
      createEnrichedItem(movie1, PreferenceStatus.WANT_TO_WATCH),
      createEnrichedItem(movie2, PreferenceStatus.ALREADY_WATCHED),
    ];

    const element = PersonalWatchlistScreen({ items }) as React.ReactElement<any>;
    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const grid = children.find((c) => c && c.props && c.props['data-testid'] === 'watchlist-grid');
    expect(grid).toBeDefined();

    const gridCards = React.Children.toArray(grid?.props.children) as React.ReactElement<any>[];
    expect(gridCards).toHaveLength(1);
    expect(gridCards[0]?.props.movie.title).toBe('Watchlist Movie');
  });
});

describe('PersonalHistoryScreen Unit Tests', () => {
  it('deve normalizar itens de historico isolando votos WANT_TO_WATCH e SKIPPED', () => {
    const movies = [
      createMockMovie(10, 'Pulp Fiction', 80, 'Crime'),
      createMockMovie(20, 'O Poderoso Chefão', 80, 'Crime'),
      createMockMovie(30, 'Clube da Luta', 18, 'Drama'),
    ];
    const items = [
      createEnrichedItem(movies[0]!, PreferenceStatus.ALREADY_WATCHED),
      createEnrichedItem(movies[1]!, PreferenceStatus.ALREADY_WATCHED),
      createEnrichedItem(movies[2]!, PreferenceStatus.WANT_TO_WATCH),
    ];

    const normalized = normalizeHistoryItems(items);
    expect(normalized).toHaveLength(2);
    expect(normalized.every((i) => i.preference.status === PreferenceStatus.ALREADY_WATCHED)).toBe(true);
  });

  it('deve renderizar cabecalho de historico, contagem e badge de privacidade', () => {
    const movies = [
      createMockMovie(10, 'Pulp Fiction', 80, 'Crime'),
      createMockMovie(20, 'O Poderoso Chefão', 80, 'Crime'),
      createMockMovie(30, 'Clube da Luta', 18, 'Drama'),
    ];
    const items = movies.map((m) => createEnrichedItem(m, PreferenceStatus.ALREADY_WATCHED));

    const element = PersonalHistoryScreen({ items }) as React.ReactElement<any>;
    expect(element).toBeDefined();
    expect(element.props['data-testid']).toBe('personal-history-screen');

    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const header = children.find((c) => c && c.type === 'header');
    expect(header).toBeDefined();

    const headerChildren = React.Children.toArray(header?.props.children) as React.ReactElement<any>[];
    const topRow = headerChildren[0];
    const topRowChildren = React.Children.toArray(topRow?.props.children) as React.ReactElement<any>[];

    const titlesCol = topRowChildren[0];
    const titleChildren = React.Children.toArray(titlesCol?.props.children) as React.ReactElement<any>[];
    const titleEl = titleChildren.find((c) => c.props['data-testid'] === 'history-title');
    expect(titleEl?.props.children).toBe('Filmes Assistidos');

    const countEl = titleChildren.find((c) => c.props['data-testid'] === 'history-count');
    expect(countEl?.props.children).toEqual([3, ' ', 'filmes assistidos']);

    const privacyBadge = topRowChildren.find(
      (c) => c.props['data-testid'] === 'history-privacy-badge',
    );
    expect(privacyBadge).toBeDefined();
  });

  it('deve exibir empty state quando o historico estiver vazio', () => {
    const element = PersonalHistoryScreen({ items: [] }) as React.ReactElement<any>;
    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const emptyState = children.find(
      (c) => c && c.props && c.props['data-testid'] === 'history-empty-state',
    );
    expect(emptyState).toBeDefined();
  });

  it('deve filtrar itens apenas com status ALREADY_WATCHED', () => {
    const movie1 = createMockMovie(11, 'Assistido 1');
    const movie2 = createMockMovie(22, 'Quero Assistir 2');
    const items = [
      createEnrichedItem(movie1, PreferenceStatus.ALREADY_WATCHED),
      createEnrichedItem(movie2, PreferenceStatus.WANT_TO_WATCH),
    ];

    const element = PersonalHistoryScreen({ items }) as React.ReactElement<any>;
    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const grid = children.find((c) => c && c.props && c.props['data-testid'] === 'history-grid');
    expect(grid).toBeDefined();

    const gridCards = React.Children.toArray(grid?.props.children) as React.ReactElement<any>[];
    expect(gridCards).toHaveLength(1);
    expect(gridCards[0]?.props.movie.title).toBe('Assistido 1');
  });
});
