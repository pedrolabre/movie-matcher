export interface User {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
