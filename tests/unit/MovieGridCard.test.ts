import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MovieGridCard } from '../../src/mobile/components/Watchlist/MovieGridCard.js';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';

function createMockMovie(id = 101, title = 'Interestelar'): Movie {
  return {
    tmdbId: id,
    title,
    originalTitle: title,
    overview: 'Uma equipe de exploradores viaja através de um buraco de minhoca no espaço.',
    posterPath: `https://image.tmdb.org/t/p/w500/poster-${id}.jpg`,
    backdropPath: `https://image.tmdb.org/t/p/original/backdrop-${id}.jpg`,
    releaseYear: 2014,
    runtimeMinutes: 169,
    voteAverage: 8.6,
    genres: [
      { id: 878, name: 'Ficção Científica' },
      { id: 18, name: 'Drama' },
    ],
    streamingProviders: [
      { providerId: 119, providerName: 'Prime Video', logoPath: '/prime.png' },
    ],
    syncedAt: new Date('2026-10-16T12:00:00Z'),
  };
}

describe('MovieGridCard Component Unit Tests', () => {
  it('deve renderizar a estrutura basica com poster, titulo, ano e nota', () => {
    const movie = createMockMovie(101, 'Interestelar');
    const element = MovieGridCard({
      movie,
      preferenceStatus: PreferenceStatus.WANT_TO_WATCH,
    }) as React.ReactElement<any>;

    expect(element).toBeDefined();
    expect(element.type).toBe('div');
    expect(element.props['data-testid']).toBe('movie-grid-card');
    expect(element.props['data-movie-id']).toBe(101);
    expect(element.props['aria-label']).toBe('Card de Interestelar');

    // Filhos do card: div do poster e div de conteudo informativo
    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    expect(children).toHaveLength(2);

    const [posterContainer, infoContainer] = children;
    expect(posterContainer?.type).toBe('div');
    expect(infoContainer?.type).toBe('div');

    // Valida elementos dentro do posterContainer
    const posterChildren = React.Children.toArray(posterContainer?.props.children) as React.ReactElement<any>[];
    const imgEl = posterChildren.find((c) => c.type === 'img');
    expect(imgEl?.props.src).toBe(movie.posterPath);
    expect(imgEl?.props.alt).toBe('Interestelar');

    const ratingEl = posterChildren.find((c) => c.props['data-testid'] === 'grid-card-rating');
    expect(ratingEl).toBeDefined();

    const yearEl = posterChildren.find((c) => c.props['data-testid'] === 'grid-card-year');
    expect(yearEl).toBeDefined();
    expect(yearEl?.props.children).toBe(2014);

    const statusEl = posterChildren.find(
      (c) => c.props['data-testid'] === 'grid-card-status-want_to_watch',
    );
    expect(statusEl).toBeDefined();
    expect(statusEl?.props.children).toBe('Quero Assistir');
  });

  it('deve renderizar badge de status Ja Assisti quando preferenceStatus for ALREADY_WATCHED', () => {
    const movie = createMockMovie(202, 'Matrix');
    const element = MovieGridCard({
      movie,
      preferenceStatus: PreferenceStatus.ALREADY_WATCHED,
    }) as React.ReactElement<any>;

    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const posterContainer = children[0];
    const posterChildren = React.Children.toArray(posterContainer?.props.children) as React.ReactElement<any>[];

    const statusEl = posterChildren.find(
      (c) => c.props['data-testid'] === 'grid-card-status-already_watched',
    );
    expect(statusEl).toBeDefined();
    expect(statusEl?.props.children).toBe('Já Assisti');
  });

  it('deve disparar callback onToggleStatus com ALREADY_WATCHED quando estiver na watchlist', () => {
    const movie = createMockMovie(303, 'A Origem');
    const onToggle = vi.fn();
    const element = MovieGridCard({
      movie,
      preferenceStatus: PreferenceStatus.WANT_TO_WATCH,
      onToggleStatus: onToggle,
    }) as React.ReactElement<any>;

    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const infoContainer = children[1];
    const infoChildren = React.Children.toArray(infoContainer?.props.children) as React.ReactElement<any>[];

    const actionsContainer = infoChildren.find((c) => c.props['data-testid'] === 'grid-card-actions');
    expect(actionsContainer).toBeDefined();

    const actionButtons = React.Children.toArray(actionsContainer?.props.children) as React.ReactElement<any>[];
    const toggleBtn = actionButtons.find((c) => c.props['data-testid'] === 'btn-toggle-status');
    expect(toggleBtn).toBeDefined();

    const mockEvent = { stopPropagation: vi.fn() } as unknown as React.MouseEvent;
    toggleBtn?.props.onClick(mockEvent);

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith(303, PreferenceStatus.ALREADY_WATCHED);
  });

  it('deve disparar callback onToggleStatus com WANT_TO_WATCH quando estiver no historico', () => {
    const movie = createMockMovie(404, 'Blade Runner 2049');
    const onToggle = vi.fn();
    const element = MovieGridCard({
      movie,
      preferenceStatus: PreferenceStatus.ALREADY_WATCHED,
      onToggleStatus: onToggle,
    }) as React.ReactElement<any>;

    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const infoContainer = children[1];
    const infoChildren = React.Children.toArray(infoContainer?.props.children) as React.ReactElement<any>[];
    const actionsContainer = infoChildren.find((c) => c.props['data-testid'] === 'grid-card-actions');
    const actionButtons = React.Children.toArray(actionsContainer?.props.children) as React.ReactElement<any>[];
    const toggleBtn = actionButtons.find((c) => c.props['data-testid'] === 'btn-toggle-status');

    const mockEvent = { stopPropagation: vi.fn() } as unknown as React.MouseEvent;
    toggleBtn?.props.onClick(mockEvent);

    expect(onToggle).toHaveBeenCalledWith(404, PreferenceStatus.WANT_TO_WATCH);
  });

  it('deve disparar callback onRemove com o tmdbId do filme ao clicar em remover', () => {
    const movie = createMockMovie(505, 'Duna');
    const onRemove = vi.fn();
    const element = MovieGridCard({
      movie,
      onRemove,
    }) as React.ReactElement<any>;

    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const infoContainer = children[1];
    const infoChildren = React.Children.toArray(infoContainer?.props.children) as React.ReactElement<any>[];
    const actionsContainer = infoChildren.find((c) => c.props['data-testid'] === 'grid-card-actions');
    const actionButtons = React.Children.toArray(actionsContainer?.props.children) as React.ReactElement<any>[];
    const removeBtn = actionButtons.find((c) => c.props['data-testid'] === 'btn-remove-item');

    const mockEvent = { stopPropagation: vi.fn() } as unknown as React.MouseEvent;
    removeBtn?.props.onClick(mockEvent);

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledWith(505);
  });

  it('deve disparar callback onPress com os dados do filme ao clicar no card', () => {
    const movie = createMockMovie(606, 'Oppenheimer');
    const onPress = vi.fn();
    const element = MovieGridCard({
      movie,
      onPress,
    }) as React.ReactElement<any>;

    element.props.onClick();
    expect(onPress).toHaveBeenCalledWith(movie);
  });

  it('nao deve renderizar botoes de acao quando showActions for falso', () => {
    const movie = createMockMovie(707, 'Tenet');
    const element = MovieGridCard({
      movie,
      showActions: false,
    }) as React.ReactElement<any>;

    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const infoContainer = children[1];
    const infoChildren = React.Children.toArray(infoContainer?.props.children) as React.ReactElement<any>[];
    const actionsContainer = infoChildren.find((c) => c && c.props && c.props['data-testid'] === 'grid-card-actions');

    expect(actionsContainer).toBeUndefined();
  });
});
