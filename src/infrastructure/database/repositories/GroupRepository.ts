import { Group } from '../../../core/domain/entities/Group.js';
import { GroupMember } from '../../../core/domain/entities/GroupMember.js';
import { GroupRole } from '../../../core/domain/enums/GroupRole.js';

export interface UserGroupMembership {
  readonly group: Group;
  readonly role: GroupRole;
  readonly joinedAt: Date;
  readonly memberCount: number;
}

export interface GroupRepository {
  create(group: Group): Promise<Group>;
  findById(groupId: string): Promise<Group | null>;
  findByInviteCode(inviteCode: string): Promise<Group | null>;
  delete(groupId: string): Promise<boolean>;

  addMember(member: GroupMember): Promise<GroupMember>;
  findMember(groupId: string, userId: string): Promise<GroupMember | null>;
  findMembersByGroupId(groupId: string): Promise<readonly GroupMember[]>;
  findGroupsByUserId(userId: string): Promise<readonly UserGroupMembership[]>;
  removeMember(groupId: string, userId: string): Promise<boolean>;
  updateMemberRole(groupId: string, userId: string, role: GroupRole): Promise<GroupMember | null>;
  countMembers(groupId: string): Promise<number>;
  clear(): Promise<void>;
}

export class InMemoryGroupRepository implements GroupRepository {
  private readonly groups = new Map<string, Group>();
  private readonly members = new Map<string, GroupMember>();

  private buildMemberKey(groupId: string, userId: string): string {
    return `${groupId}:${userId}`;
  }

  async create(group: Group): Promise<Group> {
    this.groups.set(group.id, group);
    return group;
  }

  async findById(groupId: string): Promise<Group | null> {
    return this.groups.get(groupId) ?? null;
  }

  async findByInviteCode(inviteCode: string): Promise<Group | null> {
    const normalizedCode = inviteCode.trim().toUpperCase();
    for (const group of this.groups.values()) {
      if (group.inviteCode.toUpperCase() === normalizedCode) {
        return group;
      }
    }
    return null;
  }

  async delete(groupId: string): Promise<boolean> {
    const existed = this.groups.delete(groupId);
    if (!existed) {
      return false;
    }

    for (const [key, member] of this.members.entries()) {
      if (member.groupId === groupId) {
        this.members.delete(key);
      }
    }

    return true;
  }

  async addMember(member: GroupMember): Promise<GroupMember> {
    const key = this.buildMemberKey(member.groupId, member.userId);
    this.members.set(key, member);
    return member;
  }

  async findMember(groupId: string, userId: string): Promise<GroupMember | null> {
    const key = this.buildMemberKey(groupId, userId);
    return this.members.get(key) ?? null;
  }

  async findMembersByGroupId(groupId: string): Promise<readonly GroupMember[]> {
    const results: GroupMember[] = [];
    for (const member of this.members.values()) {
      if (member.groupId === groupId) {
        results.push(member);
      }
    }
    return results.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  }

  async findGroupsByUserId(userId: string): Promise<readonly UserGroupMembership[]> {
    const memberships: UserGroupMembership[] = [];

    for (const member of this.members.values()) {
      if (member.userId === userId) {
        const group = this.groups.get(member.groupId);
        if (group) {
          const memberCount = await this.countMembers(group.id);
          memberships.push({
            group,
            role: member.role,
            joinedAt: member.joinedAt,
            memberCount,
          });
        }
      }
    }

    return memberships.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
  }

  async removeMember(groupId: string, userId: string): Promise<boolean> {
    const key = this.buildMemberKey(groupId, userId);
    return this.members.delete(key);
  }

  async updateMemberRole(
    groupId: string,
    userId: string,
    role: GroupRole,
  ): Promise<GroupMember | null> {
    const key = this.buildMemberKey(groupId, userId);
    const existing = this.members.get(key);
    if (!existing) {
      return null;
    }

    const updated: GroupMember = {
      ...existing,
      role,
    };

    this.members.set(key, updated);
    return updated;
  }

  async countMembers(groupId: string): Promise<number> {
    let count = 0;
    for (const member of this.members.values()) {
      if (member.groupId === groupId) {
        count++;
      }
    }
    return count;
  }

  async clear(): Promise<void> {
    this.groups.clear();
    this.members.clear();
  }
}
