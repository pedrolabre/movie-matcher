export interface GroupWatchSession {
  readonly id: string;
  readonly matchId: string;
  readonly groupId: string;
  readonly scheduledAt?: Date | null;
  readonly notes?: string | null;
  readonly completedAt?: Date | null;
  readonly createdAt: Date;
}
