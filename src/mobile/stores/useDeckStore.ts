import { create } from 'zustand';
import { Movie } from '../../core/domain/entities/Movie.js';
import { PreferenceStatus } from '../../core/domain/enums/PreferenceStatus.js';

export interface DeckHistoryEntry {
  readonly movie: Movie;
  readonly status: PreferenceStatus;
  readonly timestamp: Date;
}

export type PreferenceRecordCallback = (
  movie: Movie,
  status: PreferenceStatus,
) => Promise<void> | void;

export interface DeckState {
  readonly queue: readonly Movie[];
  readonly activeMovie: Movie | null;
  readonly history: readonly DeckHistoryEntry[];
  readonly isLoading: boolean;
  readonly bufferThreshold: number;
  readonly isLowOnCards: boolean;
  readonly isEmpty: boolean;

  readonly setQueue: (movies: readonly Movie[]) => void;
  readonly enqueueMovies: (movies: readonly Movie[]) => void;
  readonly popCard: () => Movie | null;
  readonly swipeRight: (onRecord?: PreferenceRecordCallback) => Promise<Movie | null>;
  readonly swipeLeft: (onRecord?: PreferenceRecordCallback) => Promise<Movie | null>;
  readonly markAlreadyWatched: (onRecord?: PreferenceRecordCallback) => Promise<Movie | null>;
  readonly recordDecision: (
    status: PreferenceStatus,
    onRecord?: PreferenceRecordCallback,
  ) => Promise<Movie | null>;
  readonly setLoading: (loading: boolean) => void;
  readonly setBufferThreshold: (threshold: number) => void;
  readonly reset: () => void;
}

const DEFAULT_BUFFER_THRESHOLD = 5;

export const useDeckStore = create<DeckState>((set, get) => ({
  queue: [],
  activeMovie: null,
  history: [],
  isLoading: false,
  bufferThreshold: DEFAULT_BUFFER_THRESHOLD,
  isLowOnCards: true,
  isEmpty: true,

  setQueue: (movies: readonly Movie[]) => {
    if (movies.length === 0) {
      set({
        queue: [],
        activeMovie: null,
        isEmpty: true,
        isLowOnCards: true,
      });
      return;
    }

    const [firstMovie, ...remainingQueue] = movies;
    const threshold = get().bufferThreshold;

    set({
      activeMovie: firstMovie ?? null,
      queue: remainingQueue,
      isEmpty: false,
      isLowOnCards: remainingQueue.length <= threshold,
    });
  },

  enqueueMovies: (newMovies: readonly Movie[]) => {
    const state = get();
    const currentActiveId = state.activeMovie?.tmdbId;
    const existingIds = new Set(state.queue.map((m) => m.tmdbId));
    if (currentActiveId !== undefined) {
      existingIds.add(currentActiveId);
    }

    const uniqueNew = newMovies.filter((m) => !existingIds.has(m.tmdbId));
    if (uniqueNew.length === 0) {
      return;
    }

    if (state.activeMovie === null) {
      const [firstMovie, ...remainingQueue] = uniqueNew;
      set({
        activeMovie: firstMovie ?? null,
        queue: remainingQueue,
        isEmpty: false,
        isLowOnCards: remainingQueue.length <= state.bufferThreshold,
      });
      return;
    }

    const updatedQueue = [...state.queue, ...uniqueNew];
    set({
      queue: updatedQueue,
      isEmpty: false,
      isLowOnCards: updatedQueue.length <= state.bufferThreshold,
    });
  },

  popCard: () => {
    const state = get();
    const currentActive = state.activeMovie;
    if (currentActive === null) {
      return null;
    }

    const [nextActive = null, ...remainingQueue] = state.queue;
    set({
      activeMovie: nextActive,
      queue: remainingQueue,
      isEmpty: nextActive === null,
      isLowOnCards: remainingQueue.length <= state.bufferThreshold,
    });

    return currentActive;
  },

  recordDecision: async (
    status: PreferenceStatus,
    onRecord?: PreferenceRecordCallback,
  ) => {
    const state = get();
    const movieToDecide = state.activeMovie;
    if (movieToDecide === null) {
      return null;
    }

    const historyEntry: DeckHistoryEntry = {
      movie: movieToDecide,
      status,
      timestamp: new Date(),
    };

    const popped = state.popCard();
    set((prev) => ({
      history: [...prev.history, historyEntry],
    }));

    if (onRecord) {
      await onRecord(movieToDecide, status);
    }

    return popped;
  },

  swipeRight: async (onRecord?: PreferenceRecordCallback) => {
    return get().recordDecision(PreferenceStatus.WANT_TO_WATCH, onRecord);
  },

  swipeLeft: async (onRecord?: PreferenceRecordCallback) => {
    return get().recordDecision(PreferenceStatus.SKIPPED, onRecord);
  },

  markAlreadyWatched: async (onRecord?: PreferenceRecordCallback) => {
    return get().recordDecision(PreferenceStatus.ALREADY_WATCHED, onRecord);
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setBufferThreshold: (threshold: number) => {
    const queueLength = get().queue.length;
    set({
      bufferThreshold: threshold,
      isLowOnCards: queueLength <= threshold,
    });
  },

  reset: () => {
    set({
      queue: [],
      activeMovie: null,
      history: [],
      isLoading: false,
      bufferThreshold: DEFAULT_BUFFER_THRESHOLD,
      isLowOnCards: true,
      isEmpty: true,
    });
  },
}));
