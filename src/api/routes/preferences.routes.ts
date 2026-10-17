import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PreferenceService } from '../../core/services/PreferenceService.js';
import {
  getUserPreferencesQuerySchema,
  recordPreferenceBodySchema,
} from '../../core/domain/types/schemas.js';

export interface PreferencesRoutesOptions {
  preferenceService: PreferenceService;
}

export const preferencesRoutes: FastifyPluginAsync<PreferencesRoutesOptions> = async (
  fastify: FastifyInstance,
  options: PreferencesRoutesOptions,
) => {
  const { preferenceService } = options;

  fastify.post('/', async (request, reply) => {
    const body = recordPreferenceBodySchema.parse(request.body);
    const headerUserId = request.headers['x-user-id'];
    const userId = typeof headerUserId === 'string' && headerUserId.trim().length > 0
      ? headerUserId.trim()
      : body.userId;

    if (!userId) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Identificação de usuário necessária via header x-user-id ou campo userId',
      });
    }

    const result = await preferenceService.recordPreference(userId, body.movieId, body.status);
    const statusCode = result.isNew ? 201 : 200;

    return reply.status(statusCode).send({
      success: true,
      preference: result.preference,
      isNew: result.isNew,
    });
  });

  fastify.get('/me', async (request, reply) => {
    const headerUserId = request.headers['x-user-id'];
    if (typeof headerUserId !== 'string' || headerUserId.trim().length === 0) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Usuário não autenticado',
      });
    }

    const query = getUserPreferencesQuerySchema.parse(request.query);
    const preferences = await preferenceService.getUserPreferences(headerUserId.trim(), {
      status: query.status,
      includeSkipped: query.includeSkipped,
    });

    return reply.status(200).send({ preferences });
  });

  fastify.get('/', async (request, reply) => {
    const query = getUserPreferencesQuerySchema.parse(request.query);
    const headerUserId = request.headers['x-user-id'];
    const userId =
      query.userId ??
      (typeof headerUserId === 'string' && headerUserId.trim().length > 0
        ? headerUserId.trim()
        : undefined);

    if (!userId) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Identificação de usuário necessária via query param userId ou header x-user-id',
      });
    }

    const preferences = await preferenceService.getUserPreferences(userId, {
      status: query.status,
      includeSkipped: query.includeSkipped,
    });

    return reply.status(200).send({ preferences });
  });
};
