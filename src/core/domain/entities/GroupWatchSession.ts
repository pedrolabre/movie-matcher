export interface GroupWatchSession {
  readonly id: string;
  readonly matchId: string;
  readonly groupId: string;
  readonly scheduledAt?: Date | null | undefined;
  readonly notes?: string | null | undefined;
  readonly completedAt?: Date | null | undefined;
  readonly participantIds?: readonly string[] | null | undefined;
  readonly createdAt: Date;
}
