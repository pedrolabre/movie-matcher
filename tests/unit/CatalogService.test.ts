import { describe, expect, it, vi } from 'vitest';
import { Movie } from '../../src/core/domain/entities/Movie.js';
import { CatalogService } from '../../src/core/services/CatalogService.js';
import { TmdbClient } from '../../src/infrastructure/tmdb/TmdbClient.js';

describe('CatalogService', () => {
  const sampleMovie: Movie = {
    tmdbId: 101,
    title: 'Interestelar',
    originalTitle: 'Interstellar',
    overview: 'Uma equipe de exploradores viaja através de um buraco de minhoca no espaço.',
    posterPath: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/backdrop.jpg',
    releaseYear: 2014,
    runtimeMinutes: 169,
    voteAverage: 8.6,
    genres: [
      { id: 12, name: 'Aventura' },
      { id: 18, name: 'Drama' },
      { id: 878, name: 'Ficção científica' },
    ],
    streamingProviders: [
      { providerId: 119, providerName: 'Amazon Prime Video', logoPath: null },
    ],
    syncedAt: new Date('2026-10-30T10:00:00Z'),
  };

  it('deve obter filmes populares/trending paginados delegando ao TmdbClient', async () => {
    const mockTmdb = new TmdbClient({ apiKey: 'teste-key' });
    const getPopularSpy = vi.spyOn(mockTmdb, 'getPopularMovies').mockResolvedValue({
      movies: [sampleMovie],
      page: 1,
      totalPages: 10,
      totalResults: 100,
    });

    const service = new CatalogService(mockTmdb);
    const result = await service.getTrending(1);

    expect(getPopularSpy).toHaveBeenCalledWith(1);
    expect(result.movies).toHaveLength(1);
    expect(result.movies[0]?.title).toBe('Interestelar');
    expect(result.page).toBe(1);
  });

  it('deve buscar filmes textualmente delegando ao TmdbClient', async () => {
    const mockTmdb = new TmdbClient({ apiKey: 'teste-key' });
    const searchSpy = vi.spyOn(mockTmdb, 'searchMovies').mockResolvedValue({
      movies: [sampleMovie],
      page: 2,
      totalPages: 5,
      totalResults: 50,
    });

    const service = new CatalogService(mockTmdb);
    const result = await service.searchMovies('Interestelar', 2);

    expect(searchSpy).toHaveBeenCalledWith('Interestelar', 2);
    expect(result.movies).toHaveLength(1);
    expect(result.page).toBe(2);
  });

  it('deve retornar lista padronizada de generos cinematograficos', async () => {
    const service = new CatalogService();
    const genres = await service.getGenres();

    expect(genres.length).toBeGreaterThan(0);
    const scifi = genres.find((g) => g.id === 878);
    expect(scifi).toBeDefined();
    expect(scifi?.name).toBe('Ficção científica');
  });

  it('deve obter detalhes do filme delegando ao TmdbClient', async () => {
    const mockTmdb = new TmdbClient({ apiKey: 'teste-key' });
    const detailsSpy = vi.spyOn(mockTmdb, 'getMovieDetails').mockResolvedValue(sampleMovie);

    const service = new CatalogService(mockTmdb);
    const movie = await service.getMovieDetails(101);

    expect(detailsSpy).toHaveBeenCalledWith(101);
    expect(movie.tmdbId).toBe(101);
    expect(movie.title).toBe('Interestelar');
  });

  it('deve filtrar filmes por genero com getByGenre', async () => {
    const otherMovie: Movie = {
      ...sampleMovie,
      tmdbId: 202,
      title: 'Comedia Romantica',
      genres: [{ id: 35, name: 'Comédia' }],
    };

    const mockTmdb = new TmdbClient({ apiKey: 'teste-key' });
    vi.spyOn(mockTmdb, 'getPopularMovies').mockResolvedValue({
      movies: [sampleMovie, otherMovie],
      page: 1,
      totalPages: 1,
      totalResults: 2,
    });

    const service = new CatalogService(mockTmdb);
    const scifiResult = await service.getByGenre(878, 1);

    expect(scifiResult.movies).toHaveLength(1);
    expect(scifiResult.movies[0]?.tmdbId).toBe(101);
    expect(scifiResult.totalResults).toBe(1);
  });
});
