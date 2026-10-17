import { z } from 'zod';
import { PreferenceStatus } from '../enums/PreferenceStatus.js';
import { QuorumRule } from '../enums/QuorumRule.js';
import { QuorumLevel } from '../enums/QuorumLevel.js';
import { MatchStatus } from '../enums/MatchStatus.js';
import { GroupRole } from '../enums/GroupRole.js';

export const preferenceStatusSchema = z.nativeEnum(PreferenceStatus);
export const quorumRuleSchema = z.nativeEnum(QuorumRule);
export const quorumLevelSchema = z.nativeEnum(QuorumLevel);
export const matchStatusSchema = z.nativeEnum(MatchStatus);
export const groupRoleSchema = z.nativeEnum(GroupRole);

export const movieGenreSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
});

export const streamingProviderSchema = z.object({
  providerId: z.number().int().positive(),
  providerName: z.string().trim().min(1),
  logoPath: z.string().trim().nullable().optional(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().trim().email().max(255),
  displayName: z.string().trim().min(1).max(100),
  avatarUrl: z.string().trim().url().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createUserDtoSchema = z.object({
  email: z.string().trim().email().max(255),
  displayName: z.string().trim().min(1).max(100),
  avatarUrl: z.string().trim().url().nullable().optional(),
});

export const movieSchema = z.object({
  tmdbId: z.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  originalTitle: z.string().trim().max(255).nullable().optional(),
  overview: z.string().trim().nullable().optional(),
  posterPath: z.string().trim().nullable().optional(),
  backdropPath: z.string().trim().nullable().optional(),
  releaseYear: z.number().int().min(1888).max(2100).nullable().optional(),
  runtimeMinutes: z.number().int().nonnegative().nullable().optional(),
  voteAverage: z.number().min(0).max(10).nullable().optional(),
  genres: z.array(movieGenreSchema).default([]),
  streamingProviders: z.array(streamingProviderSchema).default([]),
  syncedAt: z.coerce.date(),
});

export const userMoviePreferenceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  movieId: z.number().int().positive(),
  status: preferenceStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const recordPreferenceDtoSchema = z.object({
  movieId: z.number().int().positive(),
  status: preferenceStatusSchema,
});

export const groupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  inviteCode: z.string().trim().min(6).max(16),
  createdBy: z.string().uuid(),
  thresholdRule: quorumRuleSchema,
  minPositiveVotes: z.number().int().min(2),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createGroupDtoSchema = z.object({
  name: z.string().trim().min(1).max(120),
  thresholdRule: quorumRuleSchema.default(QuorumRule.MAJORITY),
  minPositiveVotes: z.number().int().min(2).default(2),
});

export const groupMemberSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
  role: groupRoleSchema,
  joinedAt: z.coerce.date(),
});

export const groupMovieMatchSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  movieId: z.number().int().positive(),
  positiveVotesCount: z.number().int().min(1),
  quorumLevel: quorumLevelSchema,
  status: matchStatusSchema,
  matchedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const groupWatchSessionSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  groupId: z.string().uuid(),
  scheduledAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const scheduleSessionDtoSchema = z.object({
  scheduledAt: z.coerce.date(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type CreateUserDto = z.infer<typeof createUserDtoSchema>;
export type RecordPreferenceDto = z.infer<typeof recordPreferenceDtoSchema>;
export type CreateGroupDto = z.infer<typeof createGroupDtoSchema>;
export type ScheduleSessionDto = z.infer<typeof scheduleSessionDtoSchema>;

export const moviePaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const movieSearchQuerySchema = z.object({
  query: z.string().trim().min(1, 'Busca não pode ser vazia'),
  page: z.coerce.number().int().min(1).default(1),
});

export const movieDetailsParamsSchema = z.object({
  id: z.coerce.number().int().positive('ID do filme deve ser um número inteiro positivo'),
});

export type MoviePaginationQuery = z.infer<typeof moviePaginationQuerySchema>;
export type MovieSearchQuery = z.infer<typeof movieSearchQuerySchema>;
export type MovieDetailsParams = z.infer<typeof movieDetailsParamsSchema>;
