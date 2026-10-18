import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  createGroupDtoSchema,
  groupIdParamsSchema,
  joinGroupByInviteCodeBodySchema,
} from '../../core/domain/types/schemas.js';
import { GroupService } from '../../core/services/GroupService.js';

export interface GroupsRoutesOptions {
  groupService: GroupService;
}

export const groupsRoutes: FastifyPluginAsync<GroupsRoutesOptions> = async (
  fastify: FastifyInstance,
  options: GroupsRoutesOptions,
) => {
  const { groupService } = options;

  fastify.post('/', async (request, reply) => {
    const body = createGroupDtoSchema.parse(request.body);
    const headerUserId = request.headers['x-user-id'];
    const rawUserId =
      typeof headerUserId === 'string' && headerUserId.trim().length > 0
        ? headerUserId.trim()
        : (request.body as { userId?: string })?.userId;

    if (!rawUserId) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Identificação de usuário necessária via header x-user-id ou campo userId',
      });
    }

    const result = await groupService.createGroup(rawUserId, body);

    return reply.status(201).send({
      success: true,
      group: result.group,
      member: result.member,
    });
  });

  fastify.post('/join', async (request, reply) => {
    const body = joinGroupByInviteCodeBodySchema.parse(request.body);
    const headerUserId = request.headers['x-user-id'];
    const rawUserId =
      typeof headerUserId === 'string' && headerUserId.trim().length > 0
        ? headerUserId.trim()
        : body.userId;

    if (!rawUserId) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Identificação de usuário necessária via header x-user-id ou campo userId',
      });
    }

    const inviteCode = body.inviteCode ?? body.code;
    if (!inviteCode) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Código de convite obrigatório',
      });
    }

    const result = await groupService.joinByInviteCode(rawUserId, inviteCode);

    return reply.status(200).send({
      success: true,
      group: result.group,
      member: result.member,
      isNewMember: result.isNewMember,
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

    const groups = await groupService.getUserGroups(headerUserId.trim());

    return reply.status(200).send({
      success: true,
      groups,
    });
  });

  fastify.get('/:groupId', async (request, reply) => {
    const { groupId } = groupIdParamsSchema.parse(request.params);
    const group = await groupService.getGroupById(groupId);

    if (!group) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Grupo não encontrado',
      });
    }

    const members = await groupService.getGroupMembers(groupId);

    return reply.status(200).send({
      success: true,
      group,
      members,
    });
  });

  fastify.post('/:groupId/leave', async (request, reply) => {
    const { groupId } = groupIdParamsSchema.parse(request.params);
    const headerUserId = request.headers['x-user-id'];

    if (typeof headerUserId !== 'string' || headerUserId.trim().length === 0) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Usuário não autenticado',
      });
    }

    const result = await groupService.leaveGroup(headerUserId.trim(), groupId);

    return reply.status(200).send(result);
  });
};
