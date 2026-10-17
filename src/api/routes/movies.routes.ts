import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CatalogService } from '../../core/services/CatalogService.js';
import {
  movieDetailsParamsSchema,
  moviePaginationQuerySchema,
  movieSearchQuerySchema,
} from '../../core/domain/types/schemas.js';

export interface MoviesRoutesOptions {
  catalogService: CatalogService;
}

export const moviesRoutes: FastifyPluginAsync<MoviesRoutesOptions> = async (
  fastify: FastifyInstance,
  options: MoviesRoutesOptions,
) => {
  const { catalogService } = options;

  fastify.get('/trending', async (request, reply) => {
    const query = moviePaginationQuerySchema.parse(request.query);
    const result = await catalogService.getTrending(query.page);
    return reply.status(200).send(result);
  });

  fastify.get('/search', async (request, reply) => {
    const query = movieSearchQuerySchema.parse(request.query);
    const result = await catalogService.searchMovies(query.query, query.page);
    return reply.status(200).send(result);
  });

  fastify.get('/genres', async (_request, reply) => {
    const genres = await catalogService.getGenres();
    return reply.status(200).send({ genres });
  });

  fastify.get('/:id', async (request, reply) => {
    const params = movieDetailsParamsSchema.parse(request.params);
    const movie = await catalogService.getMovieDetails(params.id);
    if (!movie) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Movie not found',
      });
    }
    return reply.status(200).send(movie);
  });
};
