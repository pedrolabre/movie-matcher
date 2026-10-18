import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PreferenceService } from '../../core/services/PreferenceService.js';
import {
  deletePreferenceParamsSchema,
  getUserListQuerySchema,
} from '../../core/domain/types/schemas.js';

export interface UsersRoutesOptions {
  preferenceService: PreferenceService;
}

export const usersRoutes: FastifyPluginAsync<UsersRoutesOptions> = async (
  fastify: FastifyInstance,
  options: UsersRoutesOptions,
) => {
  const { preferenceService } = options;

  fastify.get('/me/watchlist', async (request, reply) => {
    const headerUserId = request.headers['x-user-id'];
    if (typeof headerUserId !== 'string' || headerUserId.trim().length === 0) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Usuário não autenticado',
      });
    }

    const query = getUserListQuerySchema.parse(request.query);
    const result = await preferenceService.getUserEnrichedWatchlist(headerUserId.trim(), query);

    return reply.status(200).send(result);
  });

  fastify.get('/me/history', async (request, reply) => {
    const headerUserId = request.headers['x-user-id'];
    if (typeof headerUserId !== 'string' || headerUserId.trim().length === 0) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Usuário não autenticado',
      });
    }

    const query = getUserListQuerySchema.parse(request.query);
    const result = await preferenceService.getUserEnrichedHistory(headerUserId.trim(), query);

    return reply.status(200).send(result);
  });

  fastify.delete('/me/preferences/:movieId', async (request, reply) => {
    const headerUserId = request.headers['x-user-id'];
    if (typeof headerUserId !== 'string' || headerUserId.trim().length === 0) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Usuário não autenticado',
      });
    }

    const params = deletePreferenceParamsSchema.parse(request.params);
    const removed = await preferenceService.removePreference(headerUserId.trim(), params.movieId);

    return reply.status(200).send({
      success: true,
      removed,
    });
  });

  fastify.delete('/me/watchlist/:movieId', async (request, reply) => {
    const headerUserId = request.headers['x-user-id'];
    if (typeof headerUserId !== 'string' || headerUserId.trim().length === 0) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Usuário não autenticado',
      });
    }

    const params = deletePreferenceParamsSchema.parse(request.params);
    const removed = await preferenceService.removePreference(headerUserId.trim(), params.movieId);

    return reply.status(200).send({
      success: true,
      removed,
    });
  });
};
