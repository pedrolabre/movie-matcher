import { beforeEach, describe, expect, it } from 'vitest';
import { GroupRole } from '../../src/core/domain/enums/GroupRole.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import {
  GroupError,
  GroupNotFoundError,
  GroupService,
} from '../../src/core/services/GroupService.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';

describe('GroupService', () => {
  let repository: InMemoryGroupRepository;
  let service: GroupService;

  beforeEach(() => {
    repository = new InMemoryGroupRepository();
    service = new GroupService(repository);
  });

  describe('createGroup', () => {
    it('deve criar um grupo com sucesso e definir o criador como OWNER', async () => {
      const userId = '11111111-1111-4111-8111-111111111111';
      const result = await service.createGroup(userId, {
        name: 'Clube dos Amigos',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      expect(result.group).toBeDefined();
      expect(result.group.name).toBe('Clube dos Amigos');
      expect(result.group.createdBy).toBe(userId);
      expect(result.group.inviteCode).toHaveLength(6);
      expect(result.group.thresholdRule).toBe(QuorumRule.MAJORITY);
      expect(result.group.minPositiveVotes).toBe(2);

      expect(result.member).toBeDefined();
      expect(result.member.groupId).toBe(result.group.id);
      expect(result.member.userId).toBe(userId);
      expect(result.member.role).toBe(GroupRole.OWNER);

      const members = await service.getGroupMembers(result.group.id);
      expect(members).toHaveLength(1);
      expect(members[0]?.userId).toBe(userId);
      expect(members[0]?.role).toBe(GroupRole.OWNER);
    });

    it('deve lançar erro se o userId não for fornecido', async () => {
      await expect(
        service.createGroup('', {
          name: 'Sala Teste',
          thresholdRule: QuorumRule.UNANIMOUS,
          minPositiveVotes: 2,
        }),
      ).rejects.toThrow(GroupError);
    });

    it('deve tentar gerar outro código caso ocorra colisão', async () => {
      let callCount = 0;
      const codes = ['DUPL99', 'DUPL99', 'NOVO88'];
      const collidingService = new GroupService(repository, () => {
        const code = codes[callCount] ?? 'REST88';
        callCount++;
        return code;
      });

      // Primeiro grupo recebe 'DUPL99'
      await collidingService.createGroup('user-1', {
        name: 'Grupo 1',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      // Segundo grupo colide no primeiro sorteio e resolve no segundo
      const result2 = await collidingService.createGroup('user-2', {
        name: 'Grupo 2',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      expect(result2.group.inviteCode).toBe('NOVO88');
      expect(callCount).toBe(3);
    });
  });

  describe('joinByInviteCode', () => {
    it('deve adicionar um novo usuário como MEMBER ao entrar com código válido', async () => {
      const ownerId = '11111111-1111-4111-8111-111111111111';
      const newUserId = '22222222-2222-4222-8222-222222222222';

      const { group } = await service.createGroup(ownerId, {
        name: 'Sessão Pipoca',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      const joinResult = await service.joinByInviteCode(newUserId, group.inviteCode.toLowerCase());

      expect(joinResult.group.id).toBe(group.id);
      expect(joinResult.member.userId).toBe(newUserId);
      expect(joinResult.member.role).toBe(GroupRole.MEMBER);
      expect(joinResult.isNewMember).toBe(true);

      const members = await service.getGroupMembers(group.id);
      expect(members).toHaveLength(2);
    });

    it('deve ser idempotente quando o usuário já pertence ao grupo', async () => {
      const ownerId = '11111111-1111-4111-8111-111111111111';
      const { group } = await service.createGroup(ownerId, {
        name: 'Sessão Pipoca',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      const joinResult = await service.joinByInviteCode(ownerId, group.inviteCode);
      expect(joinResult.isNewMember).toBe(false);
      expect(joinResult.member.userId).toBe(ownerId);
      expect(joinResult.member.role).toBe(GroupRole.OWNER);

      const members = await service.getGroupMembers(group.id);
      expect(members).toHaveLength(1);
    });

    it('deve lançar GroupError quando o formato do código for inválido', async () => {
      await expect(
        service.joinByInviteCode('user-1', 'INV0L1D'), // '0' e '1' são ambíguos
      ).rejects.toThrow(GroupError);

      await expect(service.joinByInviteCode('user-1', 'AB')).rejects.toThrow(GroupError);
    });

    it('deve lançar GroupNotFoundError quando o código não existir', async () => {
      await expect(
        service.joinByInviteCode('user-1', 'XXXX99'),
      ).rejects.toThrow(GroupNotFoundError);
    });
  });

  describe('getGroupById e getUserGroups', () => {
    it('deve recuperar grupo por ID e listar grupos do usuário', async () => {
      const userA = 'user-a';
      const userB = 'user-b';

      const { group: group1 } = await service.createGroup(userA, {
        name: 'Grupo 1',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      await service.createGroup(userA, {
        name: 'Grupo 2',
        thresholdRule: QuorumRule.FIXED_COUNT,
        minPositiveVotes: 3,
      });

      await service.joinByInviteCode(userB, group1.inviteCode);

      const fetched = await service.getGroupById(group1.id);
      expect(fetched?.id).toBe(group1.id);
      expect(fetched?.name).toBe('Grupo 1');

      const nonExistent = await service.getGroupById('non-existent');
      expect(nonExistent).toBeNull();

      const userAGroups = await service.getUserGroups(userA);
      expect(userAGroups).toHaveLength(2);
      expect(userAGroups[0]?.role).toBe(GroupRole.OWNER);

      const userBGroups = await service.getUserGroups(userB);
      expect(userBGroups).toHaveLength(1);
      expect(userBGroups[0]?.group.id).toBe(group1.id);
      expect(userBGroups[0]?.role).toBe(GroupRole.MEMBER);
      expect(userBGroups[0]?.memberCount).toBe(2);
    });
  });

  describe('leaveGroup', () => {
    it('deve permitir que um MEMBER saia do grupo sem afetar o grupo', async () => {
      const ownerId = 'user-owner';
      const memberId = 'user-member';

      const { group } = await service.createGroup(ownerId, {
        name: 'Cinema Terror',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      await service.joinByInviteCode(memberId, group.inviteCode);

      const leaveResult = await service.leaveGroup(memberId, group.id);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.groupDeleted).toBe(false);

      const members = await service.getGroupMembers(group.id);
      expect(members).toHaveLength(1);
      expect(members[0]?.userId).toBe(ownerId);
    });

    it('deve excluir o grupo se o OWNER sair e for o único membro', async () => {
      const ownerId = 'user-alone';
      const { group } = await service.createGroup(ownerId, {
        name: 'Grupo Solitário',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      const leaveResult = await service.leaveGroup(ownerId, group.id);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.groupDeleted).toBe(true);

      const found = await service.getGroupById(group.id);
      expect(found).toBeNull();
    });

    it('deve transferir a liderança (OWNER) para outro membro se o OWNER sair com outros membros na sala', async () => {
      const ownerId = 'user-owner';
      const memberId = 'user-successor';

      const { group } = await service.createGroup(ownerId, {
        name: 'Grupo com Sucessão',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      await service.joinByInviteCode(memberId, group.inviteCode);

      const leaveResult = await service.leaveGroup(ownerId, group.id);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.groupDeleted).toBe(false);
      expect(leaveResult.newOwnerId).toBe(memberId);

      const remainingMembers = await service.getGroupMembers(group.id);
      expect(remainingMembers).toHaveLength(1);
      expect(remainingMembers[0]?.userId).toBe(memberId);
      expect(remainingMembers[0]?.role).toBe(GroupRole.OWNER);
    });

    it('deve lançar erro ao tentar sair de grupo inexistente ou quando usuário não é membro', async () => {
      await expect(service.leaveGroup('user-1', 'non-existent')).rejects.toThrow(
        GroupNotFoundError,
      );

      const { group } = await service.createGroup('owner', {
        name: 'Grupo X',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });

      await expect(service.leaveGroup('stranger', group.id)).rejects.toThrow(GroupError);
    });
  });
});
