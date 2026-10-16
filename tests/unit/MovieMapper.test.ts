import { describe, expect, it } from 'vitest';
import { movieSchema } from '../../src/core/domain/types/schemas.js';
import { MovieMapper } from '../../src/infrastructure/tmdb/mappers/MovieMapper.js';
import {
  TmdbMovieDetailsResponse,
  TmdbMovieResult,
  TmdbWatchProvidersResponse,
} from '../../src/infrastructure/tmdb/types.js';

describe('MovieMapper', () => {
  describe('resolveImageUrl', () => {
    it('deve retornar null para caminhos nulos, indefinidos ou vazios', () => {
      expect(MovieMapper.resolveImageUrl(null)).toBeNull();
      expect(MovieMapper.resolveImageUrl(undefined)).toBeNull();
      expect(MovieMapper.resolveImageUrl('')).toBeNull();
      expect(MovieMapper.resolveImageUrl('   ')).toBeNull();
    });

    it('deve preservar URLs absolutas http ou https', () => {
      const httpUrl = 'http://cdn.example.com/poster.jpg';
      const httpsUrl = 'https://cdn.example.com/backdrop.jpg';

      expect(MovieMapper.resolveImageUrl(httpUrl)).toBe(httpUrl);
      expect(MovieMapper.resolveImageUrl(httpsUrl)).toBe(httpsUrl);
    });

    it('deve resolver caminhos relativos com o tamanho e baseUrl padrao', () => {
      const resolved = MovieMapper.resolveImageUrl('/path/to/poster.jpg');
      expect(resolved).toBe('https://image.tmdb.org/t/p/w500/path/to/poster.jpg');
    });

    it('deve suportar tamanho customizado e tratar barras excedentes', () => {
      const resolved = MovieMapper.resolveImageUrl(
        'path/to/backdrop.jpg',
        'original',
        'https://image.tmdb.org/t/p/',
      );
      expect(resolved).toBe('https://image.tmdb.org/t/p/original/path/to/backdrop.jpg');
    });
  });

  describe('sanitizeOverview', () => {
    it('deve sanitizar espacos em branco redundantes', () => {
      expect(MovieMapper.sanitizeOverview('  Uma breve sinopse de teste.  ')).toBe(
        'Uma breve sinopse de teste.',
      );
    });

    it('deve retornar null para sinopses nulas, vazias ou formadas apenas por espacos', () => {
      expect(MovieMapper.sanitizeOverview(null)).toBeNull();
      expect(MovieMapper.sanitizeOverview(undefined)).toBeNull();
      expect(MovieMapper.sanitizeOverview('')).toBeNull();
      expect(MovieMapper.sanitizeOverview('     ')).toBeNull();
    });
  });

  describe('extractReleaseYear', () => {
    it('deve extrair o ano corretamente de formato YYYY-MM-DD', () => {
      expect(MovieMapper.extractReleaseYear('2024-03-01')).toBe(2024);
      expect(MovieMapper.extractReleaseYear('1999-12-31')).toBe(1999);
    });

    it('deve retornar null para strings nulas, vazias ou com formato invalido', () => {
      expect(MovieMapper.extractReleaseYear(null)).toBeNull();
      expect(MovieMapper.extractReleaseYear(undefined)).toBeNull();
      expect(MovieMapper.extractReleaseYear('')).toBeNull();
      expect(MovieMapper.extractReleaseYear('data-invalida')).toBeNull();
    });

    it('deve retornar null para anos fora do intervalo permitido de cinema (1888 - 2100)', () => {
      expect(MovieMapper.extractReleaseYear('1800-01-01')).toBeNull();
      expect(MovieMapper.extractReleaseYear('2250-01-01')).toBeNull();
    });
  });

  describe('mapWatchProviders', () => {
    it('deve retornar array vazio se os dados de providers forem nulos ou vazios', () => {
      expect(MovieMapper.mapWatchProviders(undefined)).toEqual([]);
      expect(MovieMapper.mapWatchProviders({})).toEqual([]);
      expect(MovieMapper.mapWatchProviders({ results: {} })).toEqual([]);
    });

    it('deve mapear corretamente provedores flatrate da regiao configurada', () => {
      const mockProviders: TmdbWatchProvidersResponse = {
        id: 550,
        results: {
          BR: {
            link: 'https://tmdb.org/watch/550',
            flatrate: [
              {
                provider_id: 8,
                provider_name: 'Netflix',
                logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
                display_priority: 0,
              },
              {
                provider_id: 119,
                provider_name: 'Amazon Prime Video',
                logo_path: '/emthp39XA2GUNqUwRXZAnZ5vc9V.jpg',
                display_priority: 1,
              },
            ],
          },
        },
      };

      const providers = MovieMapper.mapWatchProviders(mockProviders, 'BR');
      expect(providers).toHaveLength(2);
      expect(providers[0]).toEqual({
        providerId: 8,
        providerName: 'Netflix',
        logoPath: 'https://image.tmdb.org/t/p/w500/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
      });
      expect(providers[1]?.providerName).toBe('Amazon Prime Video');
    });
  });

  describe('toDomainFromDetails', () => {
    it('deve mapear payload completo de detalhes e validar com o schema Zod de dominio', () => {
      const mockRaw: TmdbMovieDetailsResponse = {
        id: 157336,
        title: 'Interstellar',
        original_title: 'Interstellar',
        overview: 'As aventuras de um grupo de exploradores que utilizam um buraco de minhoca.',
        poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
        backdrop_path: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
        release_date: '2014-11-05',
        runtime: 169,
        vote_average: 8.43,
        genres: [
          { id: 12, name: 'Aventura' },
          { id: 18, name: 'Drama' },
          { id: 878, name: 'Ficção científica' },
        ],
        'watch/providers': {
          results: {
            BR: {
              flatrate: [
                {
                  provider_id: 119,
                  provider_name: 'Max',
                  logo_path: '/aS2zvJWn92ItSVbtLJYX7vgW0St.jpg',
                },
              ],
            },
          },
        },
      };

      const movie = MovieMapper.toDomainFromDetails(mockRaw);

      expect(movie.tmdbId).toBe(157336);
      expect(movie.title).toBe('Interstellar');
      expect(movie.originalTitle).toBe('Interstellar');
      expect(movie.releaseYear).toBe(2014);
      expect(movie.runtimeMinutes).toBe(169);
      expect(movie.voteAverage).toBe(8.4);
      expect(movie.posterPath).toBe(
        'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
      );
      expect(movie.backdropPath).toBe(
        'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
      );
      expect(movie.genres).toHaveLength(3);
      expect(movie.streamingProviders).toHaveLength(1);
      expect(movie.streamingProviders[0]?.providerName).toBe('Max');

      const parsed = movieSchema.parse(movie);
      expect(parsed.tmdbId).toBe(157336);
    });

    it('deve ser resiliente a campos nulos e ausentes em detalhes', () => {
      const minimalRaw: TmdbMovieDetailsResponse = {
        id: 9999,
        title: '',
        original_title: 'Minimal Film',
        overview: '',
        poster_path: null,
        backdrop_path: null,
        release_date: '',
        runtime: 0,
        vote_average: null,
      };

      const movie = MovieMapper.toDomainFromDetails(minimalRaw);

      expect(movie.tmdbId).toBe(9999);
      expect(movie.title).toBe('Minimal Film');
      expect(movie.originalTitle).toBe('Minimal Film');
      expect(movie.overview).toBeNull();
      expect(movie.posterPath).toBeNull();
      expect(movie.backdropPath).toBeNull();
      expect(movie.releaseYear).toBeNull();
      expect(movie.runtimeMinutes).toBeNull();
      expect(movie.voteAverage).toBeNull();
      expect(movie.genres).toEqual([]);
      expect(movie.streamingProviders).toEqual([]);

      const parsed = movieSchema.parse(movie);
      expect(parsed.tmdbId).toBe(9999);
    });
  });

  describe('toDomainFromList', () => {
    it('deve mapear item de listagem resolvendo generos via dicionario padrao', () => {
      const mockResult: TmdbMovieResult = {
        id: 693134,
        title: 'Duna: Parte 2',
        original_title: 'Dune: Part Two',
        overview: 'Paul Atreides se une a Chani e aos Fremen.',
        poster_path: '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
        backdrop_path: '/xOMo8BRK7PfcJv9JCnx7s520b8Q.jpg',
        release_date: '2024-02-27',
        vote_average: 8.28,
        genre_ids: [878, 12],
      };

      const movie = MovieMapper.toDomainFromList(mockResult);

      expect(movie.tmdbId).toBe(693134);
      expect(movie.title).toBe('Duna: Parte 2');
      expect(movie.originalTitle).toBe('Dune: Part Two');
      expect(movie.releaseYear).toBe(2024);
      expect(movie.runtimeMinutes).toBeNull();
      expect(movie.voteAverage).toBe(8.3);
      expect(movie.genres).toEqual([
        { id: 878, name: 'Ficção científica' },
        { id: 12, name: 'Aventura' },
      ]);
      expect(movie.streamingProviders).toEqual([]);

      const parsed = movieSchema.parse(movie);
      expect(parsed.tmdbId).toBe(693134);
    });
  });
});
