import { Movie, MovieGenre } from '../domain/entities/Movie.js';
import { MovieWatchProvidersResult } from '../domain/types/schemas.js';
import { MovieMapper } from '../../infrastructure/tmdb/mappers/MovieMapper.js';
import { PaginatedMoviesResult, TmdbClient } from '../../infrastructure/tmdb/TmdbClient.js';
import { WatchProvidersService } from '../../infrastructure/tmdb/WatchProvidersService.js';

export class CatalogService {
  private readonly tmdbClient: TmdbClient;
  private readonly watchProvidersService: WatchProvidersService;

  constructor(tmdbClient?: TmdbClient, watchProvidersService?: WatchProvidersService) {
    this.tmdbClient = tmdbClient ?? new TmdbClient();
    this.watchProvidersService =
      watchProvidersService ?? new WatchProvidersService({ tmdbClient: this.tmdbClient });
  }

  async getTrending(page = 1): Promise<PaginatedMoviesResult> {
    return this.tmdbClient.getPopularMovies(page);
  }

  async searchMovies(query: string, page = 1): Promise<PaginatedMoviesResult> {
    return this.tmdbClient.searchMovies(query, page);
  }

  async getGenres(): Promise<readonly MovieGenre[]> {
    return MovieMapper.getDefaultGenres();
  }

  async getMovieDetails(movieId: number): Promise<Movie> {
    return this.tmdbClient.getMovieDetails(movieId);
  }

  async getMovieProviders(movieId: number, region = 'BR'): Promise<MovieWatchProvidersResult> {
    return this.watchProvidersService.getMovieProviders(movieId, region);
  }

  getWatchProvidersService(): WatchProvidersService {
    return this.watchProvidersService;
  }

  async getByGenre(genreId: number, page = 1): Promise<PaginatedMoviesResult> {
    const result = await this.tmdbClient.getPopularMovies(page);
    const filteredMovies = result.movies.filter((movie) =>
      movie.genres.some((genre) => genre.id === genreId),
    );

    return {
      movies: filteredMovies,
      page: result.page,
      totalPages: result.totalPages,
      totalResults: filteredMovies.length,
    };
  }
}
