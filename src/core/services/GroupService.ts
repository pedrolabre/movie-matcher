import { randomUUID } from 'node:crypto';
import { Group } from '../domain/entities/Group.js';
import { GroupMember } from '../domain/entities/GroupMember.js';
import { GroupRole } from '../domain/enums/GroupRole.js';
import { QuorumRule } from '../domain/enums/QuorumRule.js';
import { CreateGroupDto } from '../domain/types/schemas.js';
import {
  generateInviteCode,
  isValidInviteCode,
  sanitizeInviteCode,
} from '../utils/inviteCode.js';
import {
  GroupRepository,
  InMemoryGroupRepository,
  UserGroupMembership,
} from '../../infrastructure/database/repositories/GroupRepository.js';

export class GroupError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'GroupError';
    this.statusCode = statusCode;
  }
}

export class GroupNotFoundError extends GroupError {
  constructor(message = 'Grupo não encontrado') {
    super(message, 404);
    this.name = 'GroupNotFoundError';
  }
}

export interface LeaveGroupResult {
  readonly success: boolean;
  readonly groupDeleted: boolean;
  readonly newOwnerId?: string | undefined;
}

export class GroupService {
  private readonly repository: GroupRepository;
  private readonly codeGenerator: () => string;

  constructor(
    repository?: GroupRepository,
    codeGenerator: () => string = generateInviteCode,
  ) {
    this.repository = repository ?? new InMemoryGroupRepository();
    this.codeGenerator = codeGenerator;
  }

  async createGroup(
    userId: string,
    data: CreateGroupDto,
  ): Promise<{ group: Group; member: GroupMember }> {
    if (!userId || userId.trim().length === 0) {
      throw new GroupError('ID de usuário obrigatório para criar grupo', 400);
    }

    let inviteCode = '';
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const candidate = this.codeGenerator();
      const existing = await this.repository.findByInviteCode(candidate);
      if (!existing) {
        inviteCode = candidate;
        break;
      }
      attempts++;
    }

    if (!inviteCode) {
      throw new GroupError('Falha ao gerar código de convite único', 500);
    }

    const now = new Date();
    const group: Group = {
      id: randomUUID(),
      name: data.name.trim(),
      inviteCode,
      createdBy: userId,
      thresholdRule: data.thresholdRule ?? QuorumRule.MAJORITY,
      minPositiveVotes: data.minPositiveVotes ?? 2,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(group);

    const member: GroupMember = {
      id: randomUUID(),
      groupId: group.id,
      userId,
      role: GroupRole.OWNER,
      joinedAt: now,
    };

    await this.repository.addMember(member);

    return { group, member };
  }

  async joinByInviteCode(
    userId: string,
    rawInviteCode: string,
  ): Promise<{ group: Group; member: GroupMember; isNewMember: boolean }> {
    if (!userId || userId.trim().length === 0) {
      throw new GroupError('ID de usuário obrigatório para entrar em um grupo', 400);
    }

    const sanitizedCode = sanitizeInviteCode(rawInviteCode);
    if (!isValidInviteCode(sanitizedCode)) {
      throw new GroupError('Código de convite com formato inválido', 400);
    }

    const group = await this.repository.findByInviteCode(sanitizedCode);
    if (!group) {
      throw new GroupNotFoundError('Grupo não encontrado com o código fornecido');
    }

    const existingMember = await this.repository.findMember(group.id, userId);
    if (existingMember) {
      return { group, member: existingMember, isNewMember: false };
    }

    const newMember: GroupMember = {
      id: randomUUID(),
      groupId: group.id,
      userId,
      role: GroupRole.MEMBER,
      joinedAt: new Date(),
    };

    await this.repository.addMember(newMember);

    return { group, member: newMember, isNewMember: true };
  }

  async getGroupById(groupId: string): Promise<Group | null> {
    return this.repository.findById(groupId);
  }

  async getUserGroups(userId: string): Promise<readonly UserGroupMembership[]> {
    return this.repository.findGroupsByUserId(userId);
  }

  async getGroupMembers(groupId: string): Promise<readonly GroupMember[]> {
    return this.repository.findMembersByGroupId(groupId);
  }

  async leaveGroup(userId: string, groupId: string): Promise<LeaveGroupResult> {
    const group = await this.repository.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError('Grupo não encontrado');
    }

    const member = await this.repository.findMember(groupId, userId);
    if (!member) {
      throw new GroupError('Usuário não é membro deste grupo', 400);
    }

    const memberCount = await this.repository.countMembers(groupId);

    if (member.role === GroupRole.OWNER) {
      if (memberCount <= 1) {
        await this.repository.delete(groupId);
        return { success: true, groupDeleted: true };
      }

      const allMembers = await this.repository.findMembersByGroupId(groupId);
      const remainingMembers = allMembers.filter((m) => m.userId !== userId);
      const adminSuccessor = remainingMembers.find((m) => m.role === GroupRole.ADMIN);
      const successor = adminSuccessor ?? remainingMembers[0];

      if (successor) {
        await this.repository.updateMemberRole(groupId, successor.userId, GroupRole.OWNER);
      }

      await this.repository.removeMember(groupId, userId);
      return { success: true, groupDeleted: false, newOwnerId: successor?.userId };
    }

    await this.repository.removeMember(groupId, userId);
    return { success: true, groupDeleted: false };
  }
}
