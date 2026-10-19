import { beforeEach, describe, expect, it } from 'vitest';
import { MatchIntersectionEngine } from '../../src/core/services/MatchIntersectionEngine.js';
import { InMemoryPreferenceRepository } from '../../src/infrastructure/database/repositories/PreferenceRepository.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import { InMemoryMatchRepository } from '../../src/infrastructure/database/repositories/MatchRepository.js';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { GroupRole } from '../../src/core/domain/enums/GroupRole.js';

describe('MatchIntersectionEngine Unit Tests', () => {
  let preferenceRepo: InMemoryPreferenceRepository;
  let groupRepo: InMemoryGroupRepository;
  let matchRepo: InMemoryMatchRepository;
  let engine: MatchIntersectionEngine;

  const userPedro = '00000000-0000-0000-0000-000000000001';
  const userAna = '00000000-0000-0000-0000-000000000002';
  const userLucas = '00000000-0000-0000-0000-000000000003';
  const userCarla = '00000000-0000-0000-0000-000000000004';
  const userMariana = '00000000-0000-0000-0000-000000000005';
  const userBruno = '00000000-0000-0000-0000-000000000006';

  beforeEach(async () => {
    preferenceRepo = new InMemoryPreferenceRepository();
    groupRepo = new InMemoryGroupRepository();
    matchRepo = new InMemoryMatchRepository();
    engine = new MatchIntersectionEngine(preferenceRepo, groupRepo, matchRepo);
  });

  async function createTestGroup(
    name: string,
    rule: QuorumRule,
    memberIds: string[],
    minVotes = 2,
  ): Promise<string> {
    const groupId = `group-${name.toLowerCase().replace(/\s+/g, '-')}`;
    const now = new Date();

    await groupRepo.create({
      id: groupId,
      name,
      inviteCode: `INV-${groupId.slice(-4)}`,
      createdBy: memberIds[0]!,
      thresholdRule: rule,
      minPositiveVotes: minVotes,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < memberIds.length; i++) {
      await groupRepo.addMember({
        id: `member-${groupId}-${memberIds[i]}`,
        groupId,
        userId: memberIds[i]!,
        role: i === 0 ? GroupRole.OWNER : GroupRole.MEMBER,
        joinedAt: new Date(now.getTime() + i * 1000),
      });
    }

    return groupId;
  }

  describe('Cenario Dupla / Casal (N=2, UNANIMOUS)', () => {
    it('nao deve criar match quando apenas 1 dos membros registrou interesse', async () => {
      const groupId = await createTestGroup('Casal', QuorumRule.UNANIMOUS, [
        userPedro,
        userAna,
      ]);
      const movieId = 101; // Arrival

      await preferenceRepo.upsert(userPedro, movieId, PreferenceStatus.WANT_TO_WATCH);

      const result = await engine.evaluateMovieForUserGroups(userPedro, movieId);

      expect(result.evaluatedGroupsCount).toBe(1);
      expect(result.matchedGroupIds).toHaveLength(0);
      expect(result.matches[0]?.isMatch).toBe(false);
      expect(result.matches[0]?.positiveVotesCount).toBe(1);

      const matchInDb = await matchRepo.findMatchByGroupAndMovie(groupId, movieId);
      expect(matchInDb).toBeNull();
    });

    it('deve disparar match com nivel PERFECT quando o 2o membro registrar WANT_TO_WATCH', async () => {
      const groupId = await createTestGroup('Casal', QuorumRule.UNANIMOUS, [
        userPedro,
        userAna,
      ]);
      const movieId = 101;

      // Pedro já havia votado
      await preferenceRepo.upsert(userPedro, movieId, PreferenceStatus.WANT_TO_WATCH);
      // Ana vota agora
      await preferenceRepo.upsert(userAna, movieId, PreferenceStatus.WANT_TO_WATCH);

      const result = await engine.evaluateMovieForUserGroups(userAna, movieId);

      expect(result.evaluatedGroupsCount).toBe(1);
      expect(result.matchedGroupIds).toEqual([groupId]);
      expect(result.matches[0]?.isMatch).toBe(true);
      expect(result.matches[0]?.isNewMatch).toBe(true);
      expect(result.matches[0]?.quorumLevel).toBe(QuorumLevel.PERFECT);
      expect(result.matches[0]?.positiveVotesCount).toBe(2);
      expect(result.matches[0]?.voterUserIds).toContain(userPedro);
      expect(result.matches[0]?.voterUserIds).toContain(userAna);

      const matchDetails = await engine.getGroupMatchDetails(groupId, movieId);
      expect(matchDetails).not.toBeNull();
      expect(matchDetails?.match.status).toBe(MatchStatus.ACTIVE);
      expect(matchDetails?.match.quorumLevel).toBe(QuorumLevel.PERFECT);
      expect(matchDetails?.voterUserIds).toHaveLength(2);
    });
  });

  describe('Multi-Match por Acao Unica (Pedro vota e propaga para multiplos grupos)', () => {
    it('deve gerar match simultaneo apenas nos grupos onde o quorum foi alcancado', async () => {
      // Grupo 1: Casal (Pedro + Ana, UNANIMOUS)
      const groupCasal = await createTestGroup('Casal', QuorumRule.UNANIMOUS, [
        userPedro,
        userAna,
      ]);

      // Grupo 2: Trio Cinema (Pedro + Lucas + Carla, MAJORITY -> threshold=2)
      const groupTrio = await createTestGroup('Trio Cinema', QuorumRule.MAJORITY, [
        userPedro,
        userLucas,
        userCarla,
      ]);

      // Grupo 3: Familia (Pedro + Mariana + Bruno, UNANIMOUS -> threshold=3)
      const groupFamilia = await createTestGroup('Familia', QuorumRule.UNANIMOUS, [
        userPedro,
        userMariana,
        userBruno,
      ]);

      const movieId = 202; // Interstellar

      // Precondicoes:
      // Ana já votou no Casal
      await preferenceRepo.upsert(userAna, movieId, PreferenceStatus.WANT_TO_WATCH);
      // Lucas já votou no Trio
      await preferenceRepo.upsert(userLucas, movieId, PreferenceStatus.WANT_TO_WATCH);
      // Na Familia, ninguem alem de Pedro votou ainda
      // Mariana rejeitou silenciosamente (SKIPPED)
      await preferenceRepo.upsert(userMariana, movieId, PreferenceStatus.SKIPPED);

      // Acao: Pedro vota WANT_TO_WATCH
      await preferenceRepo.upsert(userPedro, movieId, PreferenceStatus.WANT_TO_WATCH);
      const result = await engine.evaluateMovieForUserGroups(userPedro, movieId);

      expect(result.evaluatedGroupsCount).toBe(3);
      // Casal (2/2) -> Match!
      // Trio (2/3) -> Match!
      // Familia (1/3) -> Nao da match!
      expect(result.matchedGroupIds).toContain(groupCasal);
      expect(result.matchedGroupIds).toContain(groupTrio);
      expect(result.matchedGroupIds).not.toContain(groupFamilia);
      expect(result.matchedGroupIds).toHaveLength(2);

      // Verifica matches individuais gravados
      const casalMatch = await matchRepo.findMatchByGroupAndMovie(groupCasal, movieId);
      expect(casalMatch?.quorumLevel).toBe(QuorumLevel.PERFECT);

      const trioMatch = await matchRepo.findMatchByGroupAndMovie(groupTrio, movieId);
      expect(trioMatch?.quorumLevel).toBe(QuorumLevel.MINIMUM);

      const familiaMatch = await matchRepo.findMatchByGroupAndMovie(groupFamilia, movieId);
      expect(familiaMatch).toBeNull();
    });
  });

  describe('Invariante de Privacidade (Votos SKIPPED)', () => {
    it('nunca deve contabilizar votos SKIPPED e nao deve vazar rejeicoes como votantes', async () => {
      const groupId = await createTestGroup('Terror de Sexta', QuorumRule.MAJORITY, [
        userPedro,
        userAna,
        userLucas,
      ]);
      const movieId = 303; // Alien

      // Pedro vota WANT_TO_WATCH
      await preferenceRepo.upsert(userPedro, movieId, PreferenceStatus.WANT_TO_WATCH);
      // Ana e Lucas votam SKIPPED
      await preferenceRepo.upsert(userAna, movieId, PreferenceStatus.SKIPPED);
      await preferenceRepo.upsert(userLucas, movieId, PreferenceStatus.SKIPPED);

      const result = await engine.evaluateMovieForGroup(groupId, movieId);

      expect(result.isMatch).toBe(false);
      expect(result.positiveVotesCount).toBe(1);
      expect(result.voterUserIds).toEqual([userPedro]);
      expect(result.voterUserIds).not.toContain(userAna);
      expect(result.voterUserIds).not.toContain(userLucas);

      const match = await matchRepo.findMatchByGroupAndMovie(groupId, movieId);
      expect(match).toBeNull();
    });
  });

  describe('Progressao de Quorum em Grupo de 6 Pessoas (MAJORITY)', () => {
    it('deve transicionar de MINIMUM para STRONG e de STRONG para PERFECT conforme novos votos entram', async () => {
      const members = [userPedro, userAna, userLucas, userCarla, userMariana, userBruno];
      const groupId = await createTestGroup('Clube dos 6', QuorumRule.MAJORITY, members);
      const movieId = 404; // Dune

      // 1 voto (Pedro): sem match
      await preferenceRepo.upsert(userPedro, movieId, PreferenceStatus.WANT_TO_WATCH);
      let summary = await engine.evaluateMovieForGroup(groupId, movieId);
      expect(summary.isMatch).toBe(false);

      // 2 votos (Ana): sem match (threshold = ceil(6/2) = 3)
      await preferenceRepo.upsert(userAna, movieId, PreferenceStatus.WANT_TO_WATCH);
      summary = await engine.evaluateMovieForGroup(groupId, movieId);
      expect(summary.isMatch).toBe(false);

      // 3 votos (Lucas): MATCH com MINIMUM (3/6 = 50%)
      await preferenceRepo.upsert(userLucas, movieId, PreferenceStatus.WANT_TO_WATCH);
      summary = await engine.evaluateMovieForGroup(groupId, movieId);
      expect(summary.isMatch).toBe(true);
      expect(summary.isNewMatch).toBe(true);
      expect(summary.quorumLevel).toBe(QuorumLevel.MINIMUM);
      expect(summary.positiveVotesCount).toBe(3);

      // 4 votos (Carla): atualiza match para STRONG (4/6 = 66.7% >= 60%)
      await preferenceRepo.upsert(userCarla, movieId, PreferenceStatus.WANT_TO_WATCH);
      summary = await engine.evaluateMovieForGroup(groupId, movieId);
      expect(summary.isMatch).toBe(true);
      expect(summary.isNewMatch).toBe(false); // Ja existia match ativo
      expect(summary.quorumLevel).toBe(QuorumLevel.STRONG);
      expect(summary.positiveVotesCount).toBe(4);

      // 6 votos (Mariana e Bruno): atualiza match para PERFECT (6/6 = 100%)
      await preferenceRepo.upsert(userMariana, movieId, PreferenceStatus.WANT_TO_WATCH);
      await preferenceRepo.upsert(userBruno, movieId, PreferenceStatus.WANT_TO_WATCH);
      summary = await engine.evaluateMovieForGroup(groupId, movieId);
      expect(summary.isMatch).toBe(true);
      expect(summary.quorumLevel).toBe(QuorumLevel.PERFECT);
      expect(summary.positiveVotesCount).toBe(6);
      expect(summary.voterUserIds).toHaveLength(6);
    });
  });

  describe('Alteracao Retroativa de Votos & Desativacao de Match', () => {
    it('deve arquivar match ativo se voto for removido ou alterado para ALREADY_WATCHED e cair abaixo do quorum', async () => {
      const groupId = await createTestGroup('Trio', QuorumRule.MAJORITY, [
        userPedro,
        userAna,
        userLucas,
      ]);
      const movieId = 505;

      // Pedro e Ana votam WANT_TO_WATCH (2/3 -> Match MINIMUM)
      await preferenceRepo.upsert(userPedro, movieId, PreferenceStatus.WANT_TO_WATCH);
      await preferenceRepo.upsert(userAna, movieId, PreferenceStatus.WANT_TO_WATCH);

      let summary = await engine.evaluateMovieForGroup(groupId, movieId);
      expect(summary.isMatch).toBe(true);
      expect(summary.match?.status).toBe(MatchStatus.ACTIVE);

      // Ana altera voto para ALREADY_WATCHED
      await preferenceRepo.upsert(userAna, movieId, PreferenceStatus.ALREADY_WATCHED);

      // Re-avalia
      summary = await engine.evaluateMovieForGroup(groupId, movieId);
      expect(summary.isMatch).toBe(false);
      expect(summary.positiveVotesCount).toBe(1);
      expect(summary.match?.status).toBe(MatchStatus.ARCHIVED);

      // Confirma no banco que o match foi arquivado
      const matchInDb = await matchRepo.findMatchByGroupAndMovie(groupId, movieId);
      expect(matchInDb?.status).toBe(MatchStatus.ARCHIVED);
    });
  });

  describe('Metodos de Consulta e Recalculo do Grupo', () => {
    it('deve listar matches de um grupo e recalcular status sob demanda', async () => {
      const groupId = await createTestGroup('Cinefilos', QuorumRule.MAJORITY, [
        userPedro,
        userAna,
      ]);
      const movie1 = 601;
      const movie2 = 602;

      await preferenceRepo.upsert(userPedro, movie1, PreferenceStatus.WANT_TO_WATCH);
      await preferenceRepo.upsert(userAna, movie1, PreferenceStatus.WANT_TO_WATCH);

      await preferenceRepo.upsert(userPedro, movie2, PreferenceStatus.WANT_TO_WATCH);
      await preferenceRepo.upsert(userAna, movie2, PreferenceStatus.WANT_TO_WATCH);

      await engine.evaluateMovieForGroup(groupId, movie1);
      await engine.evaluateMovieForGroup(groupId, movie2);

      const matches = await engine.getGroupMatches(groupId, { status: MatchStatus.ACTIVE });
      expect(matches).toHaveLength(2);

      const recalculated = await engine.recalculateGroupMatches(groupId);
      expect(recalculated).toHaveLength(2);
      expect(recalculated.every((r) => r.isMatch)).toBe(true);
    });
  });
});
