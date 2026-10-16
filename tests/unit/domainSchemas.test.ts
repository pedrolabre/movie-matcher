import { describe, it, expect } from 'vitest';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { GroupRole } from '../../src/core/domain/enums/GroupRole.js';
import {
  preferenceStatusSchema,
  quorumRuleSchema,
  quorumLevelSchema,
  matchStatusSchema,
  groupRoleSchema,
  userSchema,
  createUserDtoSchema,
  movieSchema,
  userMoviePreferenceSchema,
  recordPreferenceDtoSchema,
  groupSchema,
  createGroupDtoSchema,
  groupMemberSchema,
  groupMovieMatchSchema,
  groupWatchSessionSchema,
  scheduleSessionDtoSchema,
} from '../../src/core/domain/types/schemas.js';

describe('Domain Enums and Schemas', () => {
  describe('PreferenceStatus Enum Schema', () => {
    it('should validate all defined preference status values', () => {
      expect(preferenceStatusSchema.parse(PreferenceStatus.WANT_TO_WATCH)).toBe('WANT_TO_WATCH');
      expect(preferenceStatusSchema.parse(PreferenceStatus.ALREADY_WATCHED)).toBe('ALREADY_WATCHED');
      expect(preferenceStatusSchema.parse(PreferenceStatus.SKIPPED)).toBe('SKIPPED');
    });

    it('should reject invalid preference status values', () => {
      expect(() => preferenceStatusSchema.parse('DISLIKED')).toThrow();
      expect(() => preferenceStatusSchema.parse(123)).toThrow();
      expect(() => preferenceStatusSchema.parse(null)).toThrow();
    });
  });

  describe('QuorumRule Enum Schema', () => {
    it('should validate all defined quorum rules', () => {
      expect(quorumRuleSchema.parse(QuorumRule.UNANIMOUS)).toBe('UNANIMOUS');
      expect(quorumRuleSchema.parse(QuorumRule.MAJORITY)).toBe('MAJORITY');
      expect(quorumRuleSchema.parse(QuorumRule.FIXED_COUNT)).toBe('FIXED_COUNT');
    });

    it('should reject invalid quorum rules', () => {
      expect(() => quorumRuleSchema.parse('SUPERMAJORITY')).toThrow();
      expect(() => quorumRuleSchema.parse('')).toThrow();
    });
  });

  describe('QuorumLevel Enum Schema', () => {
    it('should validate all defined quorum levels', () => {
      expect(quorumLevelSchema.parse(QuorumLevel.MINIMUM)).toBe('MINIMUM');
      expect(quorumLevelSchema.parse(QuorumLevel.STRONG)).toBe('STRONG');
      expect(quorumLevelSchema.parse(QuorumLevel.PERFECT)).toBe('PERFECT');
    });

    it('should reject invalid quorum levels', () => {
      expect(() => quorumLevelSchema.parse('MODERATE')).toThrow();
    });
  });

  describe('MatchStatus Enum Schema', () => {
    it('should validate all defined match lifecycle statuses', () => {
      expect(matchStatusSchema.parse(MatchStatus.ACTIVE)).toBe('ACTIVE');
      expect(matchStatusSchema.parse(MatchStatus.SCHEDULED)).toBe('SCHEDULED');
      expect(matchStatusSchema.parse(MatchStatus.WATCHED)).toBe('WATCHED');
      expect(matchStatusSchema.parse(MatchStatus.ARCHIVED)).toBe('ARCHIVED');
    });

    it('should reject invalid match statuses', () => {
      expect(() => matchStatusSchema.parse('CANCELLED')).toThrow();
    });
  });

  describe('GroupRole Enum Schema', () => {
    it('should validate all defined group roles', () => {
      expect(groupRoleSchema.parse(GroupRole.OWNER)).toBe('OWNER');
      expect(groupRoleSchema.parse(GroupRole.ADMIN)).toBe('ADMIN');
      expect(groupRoleSchema.parse(GroupRole.MEMBER)).toBe('MEMBER');
    });

    it('should reject invalid group roles', () => {
      expect(() => groupRoleSchema.parse('GUEST')).toThrow();
    });
  });

  describe('User Schema', () => {
    const validUser = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'pedro@example.com',
      displayName: 'Pedro Siqueira',
      avatarUrl: 'https://cdn.movie-matcher.app/avatars/pedro.png',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('should parse a valid user entity', () => {
      const parsed = userSchema.parse(validUser);
      expect(parsed.id).toBe(validUser.id);
      expect(parsed.email).toBe('pedro@example.com');
      expect(parsed.displayName).toBe('Pedro Siqueira');
      expect(parsed.avatarUrl).toBe(validUser.avatarUrl);
    });

    it('should allow nullable avatarUrl', () => {
      const parsed = userSchema.parse({ ...validUser, avatarUrl: null });
      expect(parsed.avatarUrl).toBeNull();
    });

    it('should reject invalid email format', () => {
      expect(() => userSchema.parse({ ...validUser, email: 'not-an-email' })).toThrow();
    });

    it('should reject non-uuid id', () => {
      expect(() => userSchema.parse({ ...validUser, id: '12345' })).toThrow();
    });

    it('should reject empty displayName', () => {
      expect(() => userSchema.parse({ ...validUser, displayName: '   ' })).toThrow();
    });

    it('should validate CreateUserDto', () => {
      const dto = {
        email: 'ana@example.com',
        displayName: 'Ana Paula',
      };
      const parsed = createUserDtoSchema.parse(dto);
      expect(parsed.email).toBe('ana@example.com');
      expect(parsed.displayName).toBe('Ana Paula');
      expect(parsed.avatarUrl).toBeUndefined();
    });
  });

  describe('Movie Schema', () => {
    const validMovie = {
      tmdbId: 329865,
      title: 'Arrival',
      originalTitle: 'Arrival',
      overview: 'A linguist works with the military to communicate with alien lifeforms.',
      posterPath: '/x22it242.jpg',
      backdropPath: '/y33it353.jpg',
      releaseYear: 2016,
      runtimeMinutes: 116,
      voteAverage: 7.9,
      genres: [{ id: 878, name: 'Science Fiction' }],
      streamingProviders: [{ providerId: 8, providerName: 'Netflix', logoPath: '/netflix.png' }],
      syncedAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('should parse a valid movie entity', () => {
      const parsed = movieSchema.parse(validMovie);
      expect(parsed.tmdbId).toBe(329865);
      expect(parsed.title).toBe('Arrival');
      expect(parsed.genres).toHaveLength(1);
      expect(parsed.genres[0]?.name).toBe('Science Fiction');
      expect(parsed.streamingProviders[0]?.providerName).toBe('Netflix');
    });

    it('should reject non-positive tmdbId', () => {
      expect(() => movieSchema.parse({ ...validMovie, tmdbId: 0 })).toThrow();
      expect(() => movieSchema.parse({ ...validMovie, tmdbId: -10 })).toThrow();
    });

    it('should reject releaseYear before cinema birth (1888)', () => {
      expect(() => movieSchema.parse({ ...validMovie, releaseYear: 1800 })).toThrow();
    });

    it('should reject voteAverage outside 0-10 range', () => {
      expect(() => movieSchema.parse({ ...validMovie, voteAverage: 10.5 })).toThrow();
      expect(() => movieSchema.parse({ ...validMovie, voteAverage: -1 })).toThrow();
    });

    it('should default empty arrays when genres and streamingProviders are omitted', () => {
      const { genres, streamingProviders, ...movieWithoutArrays } = validMovie;
      const parsed = movieSchema.parse(movieWithoutArrays);
      expect(parsed.genres).toEqual([]);
      expect(parsed.streamingProviders).toEqual([]);
    });
  });

  describe('UserMoviePreference Schema', () => {
    const validPreference = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      userId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      movieId: 329865,
      status: PreferenceStatus.WANT_TO_WATCH,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('should parse valid preference entity', () => {
      const parsed = userMoviePreferenceSchema.parse(validPreference);
      expect(parsed.status).toBe('WANT_TO_WATCH');
      expect(parsed.movieId).toBe(329865);
    });

    it('should validate RecordPreferenceDto', () => {
      const dto = { movieId: 329865, status: PreferenceStatus.SKIPPED };
      const parsed = recordPreferenceDtoSchema.parse(dto);
      expect(parsed.movieId).toBe(329865);
      expect(parsed.status).toBe('SKIPPED');
    });

    it('should reject non-positive movieId in RecordPreferenceDto', () => {
      expect(() => recordPreferenceDtoSchema.parse({ movieId: -5, status: PreferenceStatus.WANT_TO_WATCH })).toThrow();
    });
  });

  describe('Group & GroupMember Schema', () => {
    const validGroup = {
      id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      name: 'Terror de Sexta',
      inviteCode: 'TERROR26',
      createdBy: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      thresholdRule: QuorumRule.MAJORITY,
      minPositiveVotes: 3,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('should parse valid group entity', () => {
      const parsed = groupSchema.parse(validGroup);
      expect(parsed.name).toBe('Terror de Sexta');
      expect(parsed.minPositiveVotes).toBe(3);
    });

    it('should reject minPositiveVotes less than 2', () => {
      expect(() => groupSchema.parse({ ...validGroup, minPositiveVotes: 1 })).toThrow();
    });

    it('should reject inviteCode shorter than 6 characters', () => {
      expect(() => groupSchema.parse({ ...validGroup, inviteCode: 'ABC' })).toThrow();
    });

    it('should apply defaults in CreateGroupDto', () => {
      const dto = { name: 'Casal' };
      const parsed = createGroupDtoSchema.parse(dto);
      expect(parsed.name).toBe('Casal');
      expect(parsed.thresholdRule).toBe(QuorumRule.MAJORITY);
      expect(parsed.minPositiveVotes).toBe(2);
    });

    it('should parse valid GroupMember entity', () => {
      const validMember = {
        id: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        groupId: validGroup.id,
        userId: validGroup.createdBy,
        role: GroupRole.OWNER,
        joinedAt: new Date('2026-01-01T00:00:00Z'),
      };
      const parsed = groupMemberSchema.parse(validMember);
      expect(parsed.role).toBe('OWNER');
      expect(parsed.groupId).toBe(validGroup.id);
    });
  });

  describe('GroupMovieMatch Schema', () => {
    const validMatch = {
      id: 'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
      groupId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      movieId: 329865,
      positiveVotesCount: 3,
      quorumLevel: QuorumLevel.STRONG,
      status: MatchStatus.ACTIVE,
      matchedAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('should parse valid match entity', () => {
      const parsed = groupMovieMatchSchema.parse(validMatch);
      expect(parsed.positiveVotesCount).toBe(3);
      expect(parsed.quorumLevel).toBe('STRONG');
      expect(parsed.status).toBe('ACTIVE');
    });

    it('should reject positiveVotesCount less than 1', () => {
      expect(() => groupMovieMatchSchema.parse({ ...validMatch, positiveVotesCount: 0 })).toThrow();
    });
  });

  describe('GroupWatchSession Schema', () => {
    const validSession = {
      id: 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
      matchId: 'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
      groupId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      scheduledAt: new Date('2026-11-01T21:00:00Z'),
      notes: 'Trazer pipoca e refrigerante',
      completedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('should parse valid watch session entity', () => {
      const parsed = groupWatchSessionSchema.parse(validSession);
      expect(parsed.notes).toBe('Trazer pipoca e refrigerante');
      expect(parsed.completedAt).toBeNull();
    });

    it('should validate ScheduleSessionDto', () => {
      const dto = {
        scheduledAt: new Date('2026-11-01T21:00:00Z'),
        notes: 'Sessão confirmada',
      };
      const parsed = scheduleSessionDtoSchema.parse(dto);
      expect(parsed.notes).toBe('Sessão confirmada');
      expect(parsed.scheduledAt).toBeInstanceOf(Date);
    });
  });
});
