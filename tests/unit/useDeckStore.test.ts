import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../../src/mobile/stores/useDeckStore.js';
import {
  evaluateGesture,
  calculateCardRotation,
  calculateCardOpacity,
  calculateIndicatorOpacity,
  SWIPE_THRESHOLD_X,
  SWIPE_VELOCITY_THRESHOLD,
  MAX_ROTATION_DEG,
} from '../../src/mobile/components/SwipeDeck/useSwipeGesture.js';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';

function createMockMovie(id: number, title: string): Movie {
  return {
    tmdbId: id,
    title,
    originalTitle: title,
    overview: `Sinopse detalhada do filme ${title}.`,
    posterPath: `https://image.tmdb.org/t/p/w500/poster-${id}.jpg`,
    backdropPath: `https://image.tmdb.org/t/p/original/backdrop-${id}.jpg`,
    releaseYear: 2024,
    runtimeMinutes: 120,
    voteAverage: 8.4,
    genres: [
      { id: 28, name: 'Ação' },
      { id: 878, name: 'Ficção Científica' },
    ],
    streamingProviders: [
      { providerId: 8, providerName: 'Netflix', logoPath: '/netflix.png' },
    ],
    syncedAt: new Date('2026-10-16T12:00:00Z'),
  };
}

describe('useDeckStore - Gerenciamento de Estado do Deck de Swipes', () => {
  beforeEach(() => {
    useDeckStore.getState().reset();
  });

  it('deve inicializar com fila vazia, card ativo nulo e flags de estado vazio', () => {
    const state = useDeckStore.getState();

    expect(state.queue).toHaveLength(0);
    expect(state.activeMovie).toBeNull();
    expect(state.history).toHaveLength(0);
    expect(state.isEmpty).toBe(true);
    expect(state.isLowOnCards).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('deve carregar fila promovendo o primeiro filme para activeMovie e os demais para a queue', () => {
    const movies = [
      createMockMovie(1, 'Duna: Parte 2'),
      createMockMovie(2, 'Oppenheimer'),
      createMockMovie(3, 'Interestelar'),
    ];

    useDeckStore.getState().setQueue(movies);
    const state = useDeckStore.getState();

    expect(state.activeMovie?.tmdbId).toBe(1);
    expect(state.activeMovie?.title).toBe('Duna: Parte 2');
    expect(state.queue).toHaveLength(2);
    expect(state.queue[0]?.tmdbId).toBe(2);
    expect(state.queue[1]?.tmdbId).toBe(3);
    expect(state.isEmpty).toBe(false);
  });

  it('deve marcar isEmpty como true ao definir fila vazia', () => {
    useDeckStore.getState().setQueue([]);
    const state = useDeckStore.getState();

    expect(state.activeMovie).toBeNull();
    expect(state.queue).toHaveLength(0);
    expect(state.isEmpty).toBe(true);
    expect(state.isLowOnCards).toBe(true);
  });

  it('deve adicionar novos filmes via enqueueMovies sem duplicar tmdbId existentes', () => {
    const initialMovies = [
      createMockMovie(1, 'Filme 1'),
      createMockMovie(2, 'Filme 2'),
    ];
    useDeckStore.getState().setQueue(initialMovies);

    const batch = [
      createMockMovie(2, 'Filme 2 Repetido'),
      createMockMovie(3, 'Filme 3'),
      createMockMovie(1, 'Filme 1 Repetido'),
      createMockMovie(4, 'Filme 4'),
    ];

    useDeckStore.getState().enqueueMovies(batch);
    const state = useDeckStore.getState();

    expect(state.activeMovie?.tmdbId).toBe(1);
    expect(state.queue.map((m) => m.tmdbId)).toEqual([2, 3, 4]);
  });

  it('deve promover o primeiro filme a activeMovie ao fazer enqueue em deck vazio', () => {
    const newMovies = [
      createMockMovie(10, 'Blade Runner 2049'),
      createMockMovie(11, 'Matrix'),
    ];

    useDeckStore.getState().enqueueMovies(newMovies);
    const state = useDeckStore.getState();

    expect(state.activeMovie?.tmdbId).toBe(10);
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0]?.tmdbId).toBe(11);
    expect(state.isEmpty).toBe(false);
  });

  it('deve consumir card ativo e promover proximo filme da fila via popCard', () => {
    const movies = [
      createMockMovie(101, 'Alien'),
      createMockMovie(102, 'Aliens'),
    ];
    useDeckStore.getState().setQueue(movies);

    const poppedFirst = useDeckStore.getState().popCard();
    expect(poppedFirst?.tmdbId).toBe(101);

    const stateAfterFirstPop = useDeckStore.getState();
    expect(stateAfterFirstPop.activeMovie?.tmdbId).toBe(102);
    expect(stateAfterFirstPop.queue).toHaveLength(0);
    expect(stateAfterFirstPop.isEmpty).toBe(false);

    const poppedSecond = useDeckStore.getState().popCard();
    expect(poppedSecond?.tmdbId).toBe(102);

    const stateAfterSecondPop = useDeckStore.getState();
    expect(stateAfterSecondPop.activeMovie).toBeNull();
    expect(stateAfterSecondPop.queue).toHaveLength(0);
    expect(stateAfterSecondPop.isEmpty).toBe(true);

    const poppedThird = useDeckStore.getState().popCard();
    expect(poppedThird).toBeNull();
  });

  it('deve registrar intencao WANT_TO_WATCH via swipeRight e salvar no historico', async () => {
    const movies = [
      createMockMovie(201, 'A Origem'),
      createMockMovie(202, 'Tenet'),
    ];
    useDeckStore.getState().setQueue(movies);

    const onRecordMock = vi.fn();
    const decided = await useDeckStore.getState().swipeRight(onRecordMock);

    expect(decided?.tmdbId).toBe(201);
    expect(onRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ tmdbId: 201 }),
      PreferenceStatus.WANT_TO_WATCH,
    );

    const state = useDeckStore.getState();
    expect(state.activeMovie?.tmdbId).toBe(202);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.status).toBe(PreferenceStatus.WANT_TO_WATCH);
    expect(state.history[0]?.movie.tmdbId).toBe(201);
  });

  it('deve registrar intencao SKIPPED via swipeLeft e salvar no historico', async () => {
    const movies = [
      createMockMovie(301, 'Filme Ruim'),
      createMockMovie(302, 'Filme Bom'),
    ];
    useDeckStore.getState().setQueue(movies);

    const onRecordMock = vi.fn();
    const decided = await useDeckStore.getState().swipeLeft(onRecordMock);

    expect(decided?.tmdbId).toBe(301);
    expect(onRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ tmdbId: 301 }),
      PreferenceStatus.SKIPPED,
    );

    const state = useDeckStore.getState();
    expect(state.activeMovie?.tmdbId).toBe(302);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.status).toBe(PreferenceStatus.SKIPPED);
  });

  it('deve registrar intencao ALREADY_WATCHED via markAlreadyWatched', async () => {
    const movies = [createMockMovie(401, 'Filme Classico')];
    useDeckStore.getState().setQueue(movies);

    const onRecordMock = vi.fn();
    const decided = await useDeckStore.getState().markAlreadyWatched(onRecordMock);

    expect(decided?.tmdbId).toBe(401);
    expect(onRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ tmdbId: 401 }),
      PreferenceStatus.ALREADY_WATCHED,
    );

    const state = useDeckStore.getState();
    expect(state.activeMovie).toBeNull();
    expect(state.isEmpty).toBe(true);
    expect(state.history[0]?.status).toBe(PreferenceStatus.ALREADY_WATCHED);
  });

  it('deve retornar null se tentar registrar decisao em deck vazio', async () => {
    const onRecordMock = vi.fn();
    const result = await useDeckStore.getState().swipeRight(onRecordMock);

    expect(result).toBeNull();
    expect(onRecordMock).not.toHaveBeenCalled();
    expect(useDeckStore.getState().history).toHaveLength(0);
  });

  it('deve sinalizar isLowOnCards quando a contagem de cards for menor ou igual ao bufferThreshold', () => {
    const movies = Array.from({ length: 8 }, (_, i) =>
      createMockMovie(i + 1, `Filme ${i + 1}`),
    );

    useDeckStore.getState().setBufferThreshold(5);
    useDeckStore.getState().setQueue(movies);

    expect(useDeckStore.getState().isLowOnCards).toBe(false);

    useDeckStore.getState().popCard();
    useDeckStore.getState().popCard();

    expect(useDeckStore.getState().queue).toHaveLength(5);
    expect(useDeckStore.getState().isLowOnCards).toBe(true);
  });

  it('deve atualizar isLoading via setLoading', () => {
    useDeckStore.getState().setLoading(true);
    expect(useDeckStore.getState().isLoading).toBe(true);

    useDeckStore.getState().setLoading(false);
    expect(useDeckStore.getState().isLoading).toBe(false);
  });

  it('deve redefinir todo o estado ao invocar reset', () => {
    const movies = [createMockMovie(99, 'Filme Teste')];
    useDeckStore.getState().setQueue(movies);
    useDeckStore.getState().setLoading(true);

    useDeckStore.getState().reset();
    const state = useDeckStore.getState();

    expect(state.queue).toHaveLength(0);
    expect(state.activeMovie).toBeNull();
    expect(state.history).toHaveLength(0);
    expect(state.isEmpty).toBe(true);
    expect(state.isLoading).toBe(false);
  });
});

describe('useSwipeGesture - Avaliacao Matematica de Limiares e Fisica', () => {
  it('deve aprovar descarte a direita quando translationX >= SWIPE_THRESHOLD_X (120px)', () => {
    const result = evaluateGesture(120);

    expect(result.isDismissed).toBe(true);
    expect(result.direction).toBe('right');
    expect(result.status).toBe(PreferenceStatus.WANT_TO_WATCH);
  });

  it('deve aprovar descarte a esquerda quando translationX <= -SWIPE_THRESHOLD_X (-120px)', () => {
    const result = evaluateGesture(-120);

    expect(result.isDismissed).toBe(true);
    expect(result.direction).toBe('left');
    expect(result.status).toBe(PreferenceStatus.SKIPPED);
  });

  it('nao deve descartar quando translationX estiver dentro dos limiares neutros', () => {
    const neutralRight = evaluateGesture(80);
    expect(neutralRight.isDismissed).toBe(false);
    expect(neutralRight.direction).toBeNull();
    expect(neutralRight.status).toBeNull();

    const neutralLeft = evaluateGesture(-80);
    expect(neutralLeft.isDismissed).toBe(false);
    expect(neutralLeft.direction).toBeNull();
    expect(neutralLeft.status).toBeNull();
  });

  it('deve descartar por velocidade rapida (flick) mesmo com translacao inferior a 120px', () => {
    const rightFlick = evaluateGesture(50, SWIPE_VELOCITY_THRESHOLD);
    expect(rightFlick.isDismissed).toBe(true);
    expect(rightFlick.direction).toBe('right');
    expect(rightFlick.status).toBe(PreferenceStatus.WANT_TO_WATCH);

    const leftFlick = evaluateGesture(-50, -SWIPE_VELOCITY_THRESHOLD);
    expect(leftFlick.isDismissed).toBe(true);
    expect(leftFlick.direction).toBe('left');
    expect(leftFlick.status).toBe(PreferenceStatus.SKIPPED);
  });

  it('deve calcular rotacao proporcional clampada ao limite MAX_ROTATION_DEG', () => {
    const zeroRotation = calculateCardRotation(0);
    expect(zeroRotation).toBe(0);

    const halfRotation = calculateCardRotation(SWIPE_THRESHOLD_X);
    expect(halfRotation).toBe(6);

    const maxRotation = calculateCardRotation(SWIPE_THRESHOLD_X * 2);
    expect(maxRotation).toBe(MAX_ROTATION_DEG);

    const negativeMax = calculateCardRotation(-SWIPE_THRESHOLD_X * 5);
    expect(negativeMax).toBe(-MAX_ROTATION_DEG);
  });

  it('deve calcular atenuacao de opacidade do card para alem do limiar', () => {
    expect(calculateCardOpacity(0)).toBe(1);
    expect(calculateCardOpacity(100)).toBe(1);
    expect(calculateCardOpacity(120)).toBe(1);
    expect(calculateCardOpacity(200)).toBeLessThan(1);
    expect(calculateCardOpacity(500)).toBe(0);
  });

  it('deve calcular opacidade do indicador visual direcional proporcional ao deslocamento', () => {
    expect(calculateIndicatorOpacity(0, 'right')).toBe(0);
    expect(calculateIndicatorOpacity(60, 'right')).toBe(0.5);
    expect(calculateIndicatorOpacity(120, 'right')).toBe(1);
    expect(calculateIndicatorOpacity(-60, 'right')).toBe(0);

    expect(calculateIndicatorOpacity(0, 'left')).toBe(0);
    expect(calculateIndicatorOpacity(-60, 'left')).toBe(0.5);
    expect(calculateIndicatorOpacity(-120, 'left')).toBe(1);
    expect(calculateIndicatorOpacity(60, 'left')).toBe(0);
  });
});
