import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/server.js';
import { GroupRole } from '../../src/core/domain/enums/GroupRole.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { GroupService } from '../../src/core/services/GroupService.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';

describe('Groups Routes Integration (/api/groups)', () => {
  const createTestEnv = () => {
    const repository = new InMemoryGroupRepository();
    const groupService = new GroupService(repository);
    const app = buildApp({ groupService });
    return { app, groupService, repository };
  };

  describe('POST /api/groups', () => {
    it('deve criar novo grupo com status 201 via header x-user-id', async () => {
      const { app } = createTestEnv();
      const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        headers: {
          'x-user-id': userId,
        },
        payload: {
          name: 'Cineclube dos Desenvolvedores',
          thresholdRule: QuorumRule.MAJORITY,
          minPositiveVotes: 3,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.group.name).toBe('Cineclube dos Desenvolvedores');
      expect(data.group.createdBy).toBe(userId);
      expect(data.group.inviteCode).toHaveLength(6);
      expect(data.member.userId).toBe(userId);
      expect(data.member.role).toBe(GroupRole.OWNER);
    });

    it('deve criar novo grupo com status 201 quando userId for enviado no payload', async () => {
      const { app } = createTestEnv();
      const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: {
          name: 'Noite de Comédias',
          userId,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.group.name).toBe('Noite de Comédias');
      expect(data.group.createdBy).toBe(userId);
    });

    it('deve retornar 401 Unauthorized se o usuário não for identificado', async () => {
      const { app } = createTestEnv();

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: {
          name: 'Grupo Sem Dono',
        },
      });

      expect(response.statusCode).toBe(401);
      const data = response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('deve retornar 400 Bad Request se os dados do grupo forem inválidos', async () => {
      const { app } = createTestEnv();
      const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        headers: {
          'x-user-id': userId,
        },
        payload: {
          name: '', // Nome vazio
          minPositiveVotes: 1, // Mínimo é 2
        },
      });

      expect(response.statusCode).toBe(400);
      const data = response.json();
      expect(data.error).toBe('Bad Request');
    });
  });

  describe('POST /api/groups/join', () => {
    it('deve permitir que outro usuário entre no grupo com status 200', async () => {
      const { app, groupService } = createTestEnv();
      const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const guestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      const { group } = await groupService.createGroup(ownerId, {
        name: 'Sessão Quarta',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups/join',
        headers: {
          'x-user-id': guestId,
        },
        payload: {
          inviteCode: group.inviteCode,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.group.id).toBe(group.id);
      expect(data.member.userId).toBe(guestId);
      expect(data.member.role).toBe(GroupRole.MEMBER);
      expect(data.isNewMember).toBe(true);
    });

    it('deve retornar 404 Not Found se o código de convite não existir', async () => {
      const { app } = createTestEnv();
      const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups/join',
        headers: {
          'x-user-id': userId,
        },
        payload: {
          inviteCode: 'ZZZZ99',
        },
      });

      expect(response.statusCode).toBe(404);
      const data = response.json();
      expect(data.message).toContain('Grupo não encontrado');
    });

    it('deve retornar 400 Bad Request se o código de convite for inválido', async () => {
      const { app } = createTestEnv();
      const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups/join',
        headers: {
          'x-user-id': userId,
        },
        payload: {
          inviteCode: '000000', // '0' não permitido
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('deve ser idempotente se o usuário já for membro', async () => {
      const { app, groupService } = createTestEnv();
      const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

      const { group } = await groupService.createGroup(ownerId, {
        name: 'Sessão Quarta',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups/join',
        headers: {
          'x-user-id': ownerId,
        },
        payload: {
          inviteCode: group.inviteCode,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.isNewMember).toBe(false);
      expect(data.member.role).toBe(GroupRole.OWNER);
    });
  });

  describe('GET /api/groups/me', () => {
    it('deve retornar a lista de grupos do usuário com status 200', async () => {
      const { app, groupService } = createTestEnv();
      const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

      await groupService.createGroup(userId, {
        name: 'Sala Alpha',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/groups/me',
        headers: {
          'x-user-id': userId,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.groups).toHaveLength(1);
      expect(data.groups[0].group.name).toBe('Sala Alpha');
      expect(data.groups[0].role).toBe(GroupRole.OWNER);
    });

    it('deve retornar 401 se x-user-id não for fornecido', async () => {
      const { app } = createTestEnv();

      const response = await app.inject({
        method: 'GET',
        url: '/api/groups/me',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/groups/:groupId', () => {
    it('deve retornar detalhes e membros do grupo com status 200', async () => {
      const { app, groupService } = createTestEnv();
      const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

      const { group } = await groupService.createGroup(ownerId, {
        name: 'Grupo Detalhes',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/groups/${group.id}`,
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.group.name).toBe('Grupo Detalhes');
      expect(data.members).toHaveLength(1);
    });

    it('deve retornar 404 Not Found para groupId inexistente', async () => {
      const { app } = createTestEnv();

      const response = await app.inject({
        method: 'GET',
        url: '/api/groups/99999999-9999-4999-8999-999999999999',
      });

      expect(response.statusCode).toBe(404);
    });

    it('deve retornar 400 Bad Request se groupId não for um UUID válido', async () => {
      const { app } = createTestEnv();

      const response = await app.inject({
        method: 'GET',
        url: '/api/groups/invalid-id',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/groups/:groupId/leave', () => {
    it('deve permitir que o usuário saia do grupo com status 200', async () => {
      const { app, groupService } = createTestEnv();
      const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const guestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      const { group } = await groupService.createGroup(ownerId, {
        name: 'Sala Dupla',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      await groupService.joinByInviteCode(guestId, group.inviteCode);

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${group.id}/leave`,
        headers: {
          'x-user-id': guestId,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.groupDeleted).toBe(false);
    });
  });

  describe('Instanciação padrão do buildApp', () => {
    it('deve iniciar app com configurações padrão sem dependências explícitas', async () => {
      const app = buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/api/groups/me',
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
