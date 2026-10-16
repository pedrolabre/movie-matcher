import type { PreferenceStatus } from '../enums/PreferenceStatus.js';

export interface UserMoviePreference {
  readonly id: string;
  readonly userId: string;
  readonly movieId: number;
  readonly status: PreferenceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
