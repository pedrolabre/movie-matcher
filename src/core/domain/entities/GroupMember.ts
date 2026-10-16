import type { GroupRole } from '../enums/GroupRole.js';

export interface GroupMember {
  readonly id: string;
  readonly groupId: string;
  readonly userId: string;
  readonly role: GroupRole;
  readonly joinedAt: Date;
}
