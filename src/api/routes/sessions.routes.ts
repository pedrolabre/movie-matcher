import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  completeSessionBodySchema,
  groupIdParamsSchema,
  scheduleSessionDtoSchema,
  scheduleSessionParamsSchema,
  sessionIdParamsSchema,
} from '../../core/domain/types/schemas.js';
import { SessionService } from '../../core/services/SessionService.js';

export interface SessionsRoutesOptions {
  sessionService: SessionService;
}

export const sessionsRoutes: FastifyPluginAsync<SessionsRoutesOptions> = async (
  fastify: FastifyInstance,
  options: SessionsRoutesOptions,
) => {
  const { sessionService } = options;

  fastify.post('/:groupId/matches/:matchId/schedule', async (request, reply) => {
    const { groupId, matchId } = scheduleSessionParamsSchema.parse(request.params);
    const body = scheduleSessionDtoSchema.parse(request.body);

    const result = await sessionService.scheduleSession(
      groupId,
      matchId,
      body.scheduledAt,
      body.notes,
    );

    return reply.status(201).send({
      success: true,
      session: result.session,
      match: result.match,
    });
  });

  fastify.post('/:groupId/sessions/:sessionId/complete', async (request, reply) => {
    const { groupId, sessionId } = sessionIdParamsSchema.parse(request.params);
    const body = request.body
      ? completeSessionBodySchema.parse(request.body)
      : undefined;

    const result = await sessionService.completeSession(
      groupId,
      sessionId,
      body?.participantIds,
    );

    return reply.status(200).send({
      success: true,
      session: result.session,
      match: result.match,
    });
  });

  fastify.get('/:groupId/sessions', async (request, reply) => {
    const { groupId } = groupIdParamsSchema.parse(request.params);
    const sessions = await sessionService.getGroupSessions(groupId);

    return reply.status(200).send({
      success: true,
      groupId,
      sessions,
    });
  });
};
