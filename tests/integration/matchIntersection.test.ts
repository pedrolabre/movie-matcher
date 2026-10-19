import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/server.js';
import { InMemoryPreferenceRepository } from '../../src/infrastructure/database/repositories/PreferenceRepository.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import { InMemoryMatchRepository } from '../../src/infrastructure/database/repositories/MatchRepository.js';
import { MatchIntersectionEngine } from '../../src/core/services/MatchIntersectionEngine.js';
import { GroupService } from '../../src/core/services/GroupService.js';
import { PreferenceService } from '../../src/core/services/PreferenceService.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';

describe('Match Intersection & Quorum Engine Integration Tests', () => {
  let app: FastifyInstance;
  let preferenceRepo: InMemoryPreferenceRepository;
  let groupRepo: InMemoryGroupRepository;
  let matchRepo: InMemoryMatchRepository;
  let intersectionEngine: MatchIntersectionEngine;
  let groupService: GroupService;
  let preferenceService: PreferenceService;

  const userPedro = '11111111-1111-4111-8111-111111111111';
  const userAna = '22222222-2222-4222-8222-222222222222';
  const userLucas = '33333333-3333-4333-8333-333333333333';
  const userCarla = '44444444-4444-4444-8444-444444444444';

  beforeEach(async () => {
    preferenceRepo = new InMemoryPreferenceRepository();
    groupRepo = new InMemoryGroupRepository();
    matchRepo = new InMemoryMatchRepository();

    intersectionEngine = new MatchIntersectionEngine(
      preferenceRepo,
      groupRepo,
      matchRepo,
    );

    groupService = new GroupService(groupRepo);
    preferenceService = new PreferenceService(
      preferenceRepo,
      undefined,
      intersectionEngine,
    );

    app = buildApp({
      preferenceService,
      groupService,
      matchRepository: matchRepo,
      matchIntersectionEngine: intersectionEngine,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Fluxo Multi-Usuário em Grupo Dupla / Casal (UNANIMOUS, 2/2)', () => {
    it('deve gerar match com quorum PERFECT apenas quando ambos os membros votarem WANT_TO_WATCH', async () => {
      // 1. Pedro cria o grupo "Casal"
      const createGroupRes = await app.inject({
        method: 'POST',
        url: '/api/groups',
        headers: { 'x-user-id': userPedro },
        payload: {
          name: 'Nós Dois',
          thresholdRule: QuorumRule.UNANIMOUS,
          minPositiveVotes: 2,
        },
      });
      expect(createGroupRes.statusCode).toBe(201);
      const groupData = createGroupRes.json();
      const groupId = groupData.group.id;
      const inviteCode = groupData.group.inviteCode;

      // 2. Ana adere ao grupo via código de convite
      const joinRes = await app.inject({
        method: 'POST',
        url: '/api/groups/join',
        headers: { 'x-user-id': userAna },
        payload: { inviteCode },
      });
      expect(joinRes.statusCode).toBe(200);

      const movieId = 329865; // Arrival

      // 3. Pedro vota WANT_TO_WATCH
      const pedroVoteRes = await app.inject({
        method: 'POST',
        url: '/api/preferences',
        headers: { 'x-user-id': userPedro },
        payload: {
          movieId,
          status: PreferenceStatus.WANT_TO_WATCH,
        },
      });
      expect(pedroVoteRes.statusCode).toBe(201);
      const pedroVoteBody = pedroVoteRes.json();
      expect(pedroVoteBody.success).toBe(true);
      expect(pedroVoteBody.matchesGenerated).toHaveLength(0);

      // Consulta matches do grupo: ainda vazio
      const groupMatchesInitial = await app.inject({
        method: 'GET',
        url: `/api/groups/${groupId}/matches`,
      });
      expect(groupMatchesInitial.statusCode).toBe(200);
      expect(groupMatchesInitial.json().matches).toHaveLength(0);

      // 4. Ana vota WANT_TO_WATCH no mesmo filme
      const anaVoteRes = await app.inject({
        method: 'POST',
        url: '/api/preferences',
        headers: { 'x-user-id': userAna },
        payload: {
          movieId,
          status: PreferenceStatus.WANT_TO_WATCH,
        },
      });
      expect(anaVoteRes.statusCode).toBe(201);
      const anaVoteBody = anaVoteRes.json();
      expect(anaVoteBody.success).toBe(true);
      expect(anaVoteBody.matchesGenerated).toContain(groupId);

      // 5. Consulta matches do grupo: agora possui o match com PERFECT
      const groupMatchesFinal = await app.inject({
        method: 'GET',
        url: `/api/groups/${groupId}/matches`,
      });
      expect(groupMatchesFinal.statusCode).toBe(200);
      const matchesList = groupMatchesFinal.json().matches;
      expect(matchesList).toHaveLength(1);
      expect(matchesList[0].movieId).toBe(movieId);
      expect(matchesList[0].positiveVotesCount).toBe(2);
      expect(matchesList[0].quorumLevel).toBe(QuorumLevel.PERFECT);
      expect(matchesList[0].status).toBe(MatchStatus.ACTIVE);

      // 6. Detalhes com votantes
      const details = await intersectionEngine.getGroupMatchDetails(groupId, movieId);
      expect(details).not.toBeNull();
      expect(details?.voterUserIds).toContain(userPedro);
      expect(details?.voterUserIds).toContain(userAna);
    });
  });

  describe('Multi-Match por Ação Única e Preservação de Isolamento de Grupos', () => {
    it('deve gerar match simultaneamente em multiplos grupos elegiveis e isolar rejeicoes', async () => {
      // Cria Grupo 1: Casal (Pedro + Ana, UNANIMOUS)
      const resG1 = await groupService.createGroup(userPedro, {
        name: 'Casal',
        thresholdRule: QuorumRule.UNANIMOUS,
        minPositiveVotes: 2,
      });
      await groupService.joinByInviteCode(userAna, resG1.group.inviteCode);
      const g1Id = resG1.group.id;

      // Cria Grupo 2: Galera da Faculdade (Pedro + Ana + Lucas, MAJORITY -> threshold=2)
      const resG2 = await groupService.createGroup(userPedro, {
        name: 'Faculdade',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });
      await groupService.joinByInviteCode(userAna, resG2.group.inviteCode);
      await groupService.joinByInviteCode(userLucas, resG2.group.inviteCode);
      const g2Id = resG2.group.id;

      // Cria Grupo 3: Republica (Pedro + Lucas + Carla, UNANIMOUS -> threshold=3)
      const resG3 = await groupService.createGroup(userPedro, {
        name: 'Republica',
        thresholdRule: QuorumRule.UNANIMOUS,
        minPositiveVotes: 3,
      });
      await groupService.joinByInviteCode(userLucas, resG3.group.inviteCode);
      await groupService.joinByInviteCode(userCarla, resG3.group.inviteCode);
      const g3Id = resG3.group.id;

      const movieId = 157336; // Interstellar

      // Ana votou WANT_TO_WATCH
      await preferenceRepo.upsert(userAna, movieId, PreferenceStatus.WANT_TO_WATCH);

      // Lucas votou SKIPPED na Republica e Faculdade
      await preferenceRepo.upsert(userLucas, movieId, PreferenceStatus.SKIPPED);

      // Carla ainda nao votou

      // Acao: Pedro vota WANT_TO_WATCH
      const voteRes = await app.inject({
        method: 'POST',
        url: '/api/preferences',
        headers: { 'x-user-id': userPedro },
        payload: {
          movieId,
          status: PreferenceStatus.WANT_TO_WATCH,
        },
      });

      expect(voteRes.statusCode).toBe(201);
      const body = voteRes.json();
      expect(body.matchesGenerated).toContain(g1Id); // Casal deu match (Pedro + Ana = 2/2)
      expect(body.matchesGenerated).toContain(g2Id); // Faculdade deu match (Pedro + Ana = 2/3 com maioria)
      expect(body.matchesGenerated).not.toContain(g3Id); // Republica nao deu match (exige 3/3 unanime)

      // Verifica lista consensual da faculdade: match registrado mesmo com Lucas tendo votado SKIPPED
      const faculdadeMatchesRes = await app.inject({
        method: 'GET',
        url: `/api/groups/${g2Id}/matches`,
      });
      const faculdadeMatches = faculdadeMatchesRes.json().matches;
      expect(faculdadeMatches).toHaveLength(1);
      expect(faculdadeMatches[0].quorumLevel).toBe(QuorumLevel.MINIMUM);

      // Verifica que na lista de votantes apenas Pedro e Ana aparecem
      const faculdadeDetails = await intersectionEngine.getGroupMatchDetails(g2Id, movieId);
      expect(faculdadeDetails?.voterUserIds).toEqual(
        expect.arrayContaining([userPedro, userAna]),
      );
      expect(faculdadeDetails?.voterUserIds).not.toContain(userLucas);
    });
  });

  describe('Alteração Retroativa de Voto e Transição de Ciclo de Vida', () => {
    it('deve desativar match para status ARCHIVED quando remocao de voto derrubar quorum', async () => {
      const createRes = await groupService.createGroup(userPedro, {
        name: 'Trio',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      });
      await groupService.joinByInviteCode(userAna, createRes.group.inviteCode);
      await groupService.joinByInviteCode(userLucas, createRes.group.inviteCode);
      const groupId = createRes.group.id;

      const movieId = 550; // Fight Club

      // Pedro e Ana votam WANT_TO_WATCH
      await app.inject({
        method: 'POST',
        url: '/api/preferences',
        headers: { 'x-user-id': userPedro },
        payload: { movieId, status: PreferenceStatus.WANT_TO_WATCH },
      });
      await app.inject({
        method: 'POST',
        url: '/api/preferences',
        headers: { 'x-user-id': userAna },
        payload: { movieId, status: PreferenceStatus.WANT_TO_WATCH },
      });

      // Match ACTIVE no grupo
      let matchesRes = await app.inject({
        method: 'GET',
        url: `/api/groups/${groupId}/matches?status=ACTIVE`,
      });
      expect(matchesRes.json().matches).toHaveLength(1);

      // Ana remove seu voto
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/preferences/${movieId}`,
        headers: { 'x-user-id': userAna },
      });
      expect(deleteRes.statusCode).toBe(200);

      // Agora com apenas 1 voto positivo restante, o match nao estara mais ACTIVE
      matchesRes = await app.inject({
        method: 'GET',
        url: `/api/groups/${groupId}/matches?status=ACTIVE`,
      });
      expect(matchesRes.json().matches).toHaveLength(0);

      // Mas o registro historico esta arquivado
      const archivedRes = await app.inject({
        method: 'GET',
        url: `/api/groups/${groupId}/matches?status=ARCHIVED`,
      });
      expect(archivedRes.json().matches).toHaveLength(1);
    });
  });

  describe('Garantia de Erro 404 em grupo inexistente para matches', () => {
    it('deve retornar 404 Not Found se o grupo pesquisado nao existir', async () => {
      const nonExistentGroupId = '99999999-9999-4999-8999-999999999999';
      const res = await app.inject({
        method: 'GET',
        url: `/api/groups/${nonExistentGroupId}/matches`,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Not Found');
    });
  });
});
