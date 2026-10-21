import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/server.js';
import { GroupService } from '../../src/core/services/GroupService.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import { InMemoryMatchRepository } from '../../src/infrastructure/database/repositories/MatchRepository.js';
import { InMemoryPreferenceRepository } from '../../src/infrastructure/database/repositories/PreferenceRepository.js';
import { MatchIntersectionEngine } from '../../src/core/services/MatchIntersectionEngine.js';
import { CatalogService } from '../../src/core/services/CatalogService.js';
import { TmdbClient } from '../../src/infrastructure/tmdb/TmdbClient.js';
import { MemoryCacheService } from '../../src/infrastructure/cache/MemoryCacheService.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';

describe('Roulette Routes Integration (/api/groups/:groupId/roulette)', () => {
  let app: FastifyInstance;
  let groupRepository: InMemoryGroupRepository;
  let matchRepository: InMemoryMatchRepository;
  let preferenceRepository: InMemoryPreferenceRepository;
  let groupService: GroupService;
  let catalogService: CatalogService;
  let matchEngine: MatchIntersectionEngine;

  const ownerId = '11111111-1111-4111-8111-111111111111';
  let groupId: string;
  let matchId1: string;
  let matchId2: string;

  beforeEach(async () => {
    groupRepository = new InMemoryGroupRepository();
    matchRepository = new InMemoryMatchRepository();
    preferenceRepository = new InMemoryPreferenceRepository();
    catalogService = new CatalogService(new TmdbClient({ apiKey: 'test', cacheService: new MemoryCacheService() }));
    groupService = new GroupService(groupRepository);

    matchEngine = new MatchIntersectionEngine(
      preferenceRepository,
      groupRepository,
      matchRepository,
      null,
      null,
      catalogService,
    );

    app = buildApp({
      groupService,
      matchRepository,
      matchIntersectionEngine: matchEngine,
      catalogService,
    });

    await app.ready();

    // Cria grupo de teste
    const groupResult = await groupService.createGroup(ownerId, {
      name: 'Cinema de Domingo',
      thresholdRule: QuorumRule.MAJORITY,
      minPositiveVotes: 2,
    });
    groupId = groupResult.group.id;

    // Cria matches consensuais ativos
    const match1 = await matchRepository.upsertMatch({
      groupId,
      movieId: 550, // Fight Club (Drama)
      positiveVotesCount: 3,
      quorumLevel: QuorumLevel.STRONG,
      status: MatchStatus.ACTIVE,
    }, [ownerId]);
    matchId1 = match1.id;

    const match2 = await matchRepository.upsertMatch({
      groupId,
      movieId: 680, // Pulp Fiction (Crime)
      positiveVotesCount: 5,
      quorumLevel: QuorumLevel.PERFECT,
      status: MatchStatus.ACTIVE,
    }, [ownerId]);
    matchId2 = match2.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('deve sortear um filme com status 200 no modo uniforme por padrão', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${groupId}/roulette`,
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.success).toBe(true);
    expect(body.groupId).toBe(groupId);
    expect([matchId1, matchId2]).toContain(body.selectedMatch.id);
    expect(body.totalCandidates).toBe(2);
    expect(body.mode).toBe('uniform');
    expect(body.selectionProbability).toBeCloseTo(0.5, 2);
    expect(body.movie).toBeDefined();
    expect(typeof body.selectedIndex).toBe('number');
  });

  it('deve realizar sorteio ponderado (weighted) baseado nos votos positivos', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${groupId}/roulette`,
      payload: {
        mode: 'weighted',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.success).toBe(true);
    expect(body.mode).toBe('weighted');
    expect(body.totalCandidates).toBe(2);
    // Votos: 3 (match1) e 5 (match2) => total = 8.
    // Probabilidade deve ser 3/8 = 0.375 ou 5/8 = 0.625
    expect([0.375, 0.625]).toContain(body.selectionProbability);
  });

  it('deve filtrar os candidatos quando candidateMatchIds for especificado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${groupId}/roulette`,
      payload: {
        candidateMatchIds: [matchId2],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.success).toBe(true);
    expect(body.selectedMatch.id).toBe(matchId2);
    expect(body.totalCandidates).toBe(1);
    expect(body.selectedIndex).toBe(0);
    expect(body.selectionProbability).toBe(1.0);
  });

  it('deve retornar 400 se candidateMatchIds for um array vazio', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${groupId}/roulette`,
      payload: {
        candidateMatchIds: [],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Bad Request');
  });

  it('deve retornar 400 se groupId for malformatado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/groups/not-a-valid-uuid/roulette',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('deve retornar 404 se o grupo não existir', async () => {
    const nonExistent = '99999999-9999-4999-8999-999999999999';
    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${nonExistent}/roulette`,
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.message).toContain('Grupo não encontrado');
  });

  it('deve retornar 400 quando o grupo não possuir nenhum match ativo', async () => {
    // Cria novo grupo sem matches
    const emptyGroup = await groupService.createGroup(ownerId, {
      name: 'Grupo Sem Matches',
      thresholdRule: QuorumRule.MAJORITY,
      minPositiveVotes: 2,
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/groups/${emptyGroup.group.id}/roulette`,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.message).toContain('Nenhum match ativo elegível');
  });
});
