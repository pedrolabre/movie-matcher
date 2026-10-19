import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  getGroupEventsQuerySchema,
  groupIdParamsSchema,
} from '../../core/domain/types/schemas.js';
import { GroupService } from '../../core/services/GroupService.js';
import { MatchEventBus } from '../../infrastructure/events/MatchEventEmitter.js';

export interface EventsRoutesOptions {
  groupService: GroupService;
  eventBus: MatchEventBus;
}

export const eventsRoutes: FastifyPluginAsync<EventsRoutesOptions> = async (
  fastify: FastifyInstance,
  options: EventsRoutesOptions,
) => {
  const { groupService, eventBus } = options;

  fastify.get('/:groupId/events', async (request, reply) => {
    const { groupId } = groupIdParamsSchema.parse(request.params);
    const query = getGroupEventsQuerySchema.parse(request.query);

    const group = await groupService.getGroupById(groupId);
    if (!group) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Grupo não encontrado',
      });
    }

    const events = await eventBus.getRecentEvents(groupId, {
      since: query.since,
      limit: query.limit,
    });

    return reply.status(200).send({
      success: true,
      groupId,
      events,
    });
  });

  fastify.get('/:groupId/events/stream', async (request, reply) => {
    const { groupId } = groupIdParamsSchema.parse(request.params);

    const group = await groupService.getGroupById(groupId);
    if (!group) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Grupo não encontrado',
      });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders?.();

    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({ groupId, status: 'connected' })}\n\n`,
    );

    const subscription = eventBus.subscribe(groupId, (event) => {
      reply.raw.write(`event: match\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const isTestClose =
      request.headers['x-test-sse-close'] === 'true' ||
      (request.query as { autoClose?: string })?.autoClose === 'true';

    if (isTestClose) {
      reply.raw.end();
      subscription.unsubscribe();
    }

    request.raw.on('close', () => {
      subscription.unsubscribe();
    });

    return reply;
  });
};
