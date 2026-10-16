export const PreferenceStatus = {
  WANT_TO_WATCH: 'WANT_TO_WATCH',
  ALREADY_WATCHED: 'ALREADY_WATCHED',
  SKIPPED: 'SKIPPED',
} as const;

export type PreferenceStatus = (typeof PreferenceStatus)[keyof typeof PreferenceStatus];
