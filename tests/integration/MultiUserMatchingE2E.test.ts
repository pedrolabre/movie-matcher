import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/server.js';
import { InMemoryPreferenceRepository } from '../../src/infrastructure/database/repositories/PreferenceRepository.js';
import { InMemoryGroupRepository } from '../../src/infrastructure/database/repositories/GroupRepository.js';
import { InMemoryMatchRepository } from '../../src/infrastructure/database/repositories/MatchRepository.js';
import { InMemorySessionRepository } from '../../src/infrastructure/database/repositories/SessionRepository.js';
import { InMemoryMatchEventEmitter } from '../../src/infrastructure/events/MatchEventEmitter.js';
import { PushNotificationService } from '../../src/infrastructure/notifications/PushNotificationService.js';
import { MatchIntersectionEngine } from '../../src/core/services/MatchIntersectionEngine.js';
import { GroupService } from '../../src/core/services/GroupService.js';
import { PreferenceService } from '../../src/core/services/PreferenceService.js';
import { SessionService } from '../../src/core/services/SessionService.js';
import { CatalogService } from '../../src/core/services/CatalogService.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';
import { MatchStatus } from '../../src/core/domain/enums/MatchStatus.js';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { Movie } from '../../src/core/domain/entities/Movie.js';

describe('Multi-User & Multi-Group End-to-End Integration Suite (MultiUserMatchingE2E)', () => {
  let app: FastifyInstance;
  let preferenceRepo: InMemoryPreferenceRepository;
  let groupRepo: InMemoryGroupRepository;
  let matchRepo: InMemoryMatchRepository;
  let sessionRepo: InMemorySessionRepository;
  let eventBus: InMemoryMatchEventEmitter;
  let notificationService: PushNotificationService;
  let intersectionEngine: MatchIntersectionEngine;
  let groupService: GroupService;
  let preferenceService: PreferenceService;
  let sessionService: SessionService;
  let catalogService: CatalogService;

  // Usuários de teste realistas
  const userPedro = '11111111-1111-4111-8111-111111111111';
  const userAna = '22222222-2222-4222-8222-222222222222';
  const userLucas = '33333333-3333-4333-8333-333333333333';

  // Catálogo de filmes de teste
  const movieDune: Movie = {
    tmdbId: 438631,
    title: 'Duna',
    originalTitle: 'Dune',
    overview: 'Paul Atreides viaja para o planeta mais perigoso do universo...',
    posterPath: '/dune-poster.jpg',
    backdropPath: '/dune-backdrop.jpg',
    releaseYear: 2021,
    runtimeMinutes: 155,
    voteAverage: 8.0,
    genres: [
      { id: 878, name: 'Ficção científica' },
      { id: 12, name: 'Aventura' },
    ],
    streamingProviders: [
      {
        providerId: 1899,
        providerName: 'Max',
        slug: 'max',
        logoPath: '/max.png',
        brandColor: '#002BE7',
        displayPriority: 1,
      },
    ],
    syncedAt: new Date(),
  };

  const movieAlien: Movie = {
    tmdbId: 348,
    title: 'Alien, o Oitavo Passageiro',
    originalTitle: 'Alien',
    overview: 'A tripulação da Nostromo intercepta um sinal de socorro misterioso...',
    releaseYear: 1979,
    runtimeMinutes: 117,
    voteAverage: 8.2,
    genres: [
      { id: 27, name: 'Terror' },
      { id: 878, name: 'Ficção científica' },
    ],
    streamingProviders: [
      {
        providerId: 337,
        providerName: 'Disney Plus',
        slug: 'disney-plus',
        logoPath: '/disney.png',
        brandColor: '#113CCF',
        displayPriority: 2,
      },
    ],
    syncedAt: new Date(),
  };

  const movieInterstellar: Movie = {
    tmdbId: 157336,
    title: 'Interestelar',
    originalTitle: 'Interstellar',
    overview: 'As reservas da Terra estão chegando ao fim e astronautas buscam um novo lar...',
    releaseYear: 2014,
    runtimeMinutes: 169,
    voteAverage: 8.4,
    genres: [
      { id: 878, name: 'Ficção científica' },
      { id: 18, name: 'Drama' },
    ],
    streamingProviders: [
      {
        providerId: 119,
        providerName: 'Prime Video',
        slug: 'amazon-prime-video',
        logoPath: '/prime.png',
        brandColor: '#00A8E1',
        displayPriority: 3,
      },
    ],
    syncedAt: new Date(),
  };

  beforeEach(async () => {
    preferenceRepo = new InMemoryPreferenceRepository();
    groupRepo = new InMemoryGroupRepository();
    matchRepo = new InMemoryMatchRepository();
    sessionRepo = new InMemorySessionRepository();
    eventBus = new InMemoryMatchEventEmitter();
    notificationService = new PushNotificationService();

    catalogService = {
      getMovieDetails: async (tmdbId: number) => {
        if (tmdbId === 438631) return movieDune;
        if (tmdbId === 348) return movieAlien;
        if (tmdbId === 157336) return movieInterstellar;
        throw new Error(`Movie ${tmdbId} not found in mock catalog`);
      },
    } as unknown as CatalogService;

    groupService = new GroupService(groupRepo);
    intersectionEngine = new MatchIntersectionEngine(
      preferenceRepo,
      groupRepo,
      matchRepo,
      eventBus,
      notificationService,
      catalogService,
    );
    preferenceService = new PreferenceService(
      preferenceRepo,
      catalogService,
      intersectionEngine,
    );
    sessionService = new SessionService(
      sessionRepo,
      matchRepo,
      groupRepo,
      catalogService,
    );

    app = buildApp({
      catalogService,
      preferenceService,
      groupService,
      matchRepository: matchRepo,
      sessionRepository: sessionRepo,
      sessionService,
      matchIntersectionEngine: intersectionEngine,
      matchEventBus: eventBus,
      notificationService,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Jornada End-to-End Completa: Multi-usuário, multi-grupo, quórum, invariante de privacidade, sessões e roleta', async () => {
    // =========================================================================
    // ETAPA 1: Setup Multi-Usuário e Multi-Grupo
    // =========================================================================

    // 1.1. Pedro cria o grupo "Casal" (Pedro + Ana, UNANIMOUS, quórum 2/2)
    const createCasalRes = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userPedro },
      payload: {
        name: 'Casal',
        thresholdRule: QuorumRule.UNANIMOUS,
        minPositiveVotes: 2,
      },
    });
    expect(createCasalRes.statusCode).toBe(201);
    const casalData = createCasalRes.json().group;
    const casalGroupId: string = casalData.id;
    const casalInviteCode: string = casalData.inviteCode;
    expect(casalGroupId).toBeDefined();

    // 1.2. Ana adere ao grupo "Casal"
    const joinCasalRes = await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      headers: { 'x-user-id': userAna },
      payload: { inviteCode: casalInviteCode },
    });
    expect(joinCasalRes.statusCode).toBe(200);

    // 1.3. Pedro cria o grupo "Galera da Faculdade" (Pedro + Ana + Lucas, MAJORITY, quórum 2/3)
    const createFaculdadeRes = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { 'x-user-id': userPedro },
      payload: {
        name: 'Galera da Faculdade',
        thresholdRule: QuorumRule.MAJORITY,
        minPositiveVotes: 2,
      },
    });
    expect(createFaculdadeRes.statusCode).toBe(201);
    const faculdadeData = createFaculdadeRes.json().group;
    const faculdadeGroupId: string = faculdadeData.id;
    const faculdadeInviteCode: string = faculdadeData.inviteCode;
    expect(faculdadeGroupId).toBeDefined();

    // 1.4. Ana e Lucas aderem à "Galera da Faculdade"
    const joinFaculdadeAnaRes = await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      headers: { 'x-user-id': userAna },
      payload: { inviteCode: faculdadeInviteCode },
    });
    expect(joinFaculdadeAnaRes.statusCode).toBe(200);

    const joinFaculdadeLucasRes = await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      headers: { 'x-user-id': userLucas },
      payload: { inviteCode: faculdadeInviteCode },
    });
    expect(joinFaculdadeLucasRes.statusCode).toBe(200);

    // 1.5. Verifica participação nos grupos
    const pedroGroupsRes = await app.inject({
      method: 'GET',
      url: '/api/groups/me',
      headers: { 'x-user-id': userPedro },
    });
    expect(pedroGroupsRes.statusCode).toBe(200);
    expect(pedroGroupsRes.json().groups).toHaveLength(2);

    const lucasGroupsRes = await app.inject({
      method: 'GET',
      url: '/api/groups/me',
      headers: { 'x-user-id': userLucas },
    });
    expect(lucasGroupsRes.statusCode).toBe(200);
    expect(lucasGroupsRes.json().groups).toHaveLength(1);
    expect(lucasGroupsRes.json().groups[0].group.id).toBe(faculdadeGroupId);

    // =========================================================================
    // ETAPA 2: Swipes Desacoplados e Propagação Multi-Match Assíncrona
    // =========================================================================

    // 2.1. Pedro dá swipe positivo em Dune (438631) e Alien (348)
    const pedroDuneRes = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': userPedro },
      payload: {
        movieId: movieDune.tmdbId,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });
    expect(pedroDuneRes.statusCode).toBe(201);
    expect(pedroDuneRes.json().matchesGenerated).toHaveLength(0); // Quórum ainda não alcançado em nenhum grupo

    const pedroAlienRes = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': userPedro },
      payload: {
        movieId: movieAlien.tmdbId,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });
    expect(pedroAlienRes.statusCode).toBe(201);
    expect(pedroAlienRes.json().matchesGenerated).toHaveLength(0);

    // Verifica que ambas as watchlists de grupo continuam vazias
    const casalMatchesBeforeAna = await app.inject({
      method: 'GET',
      url: `/api/groups/${casalGroupId}/matches`,
    });
    expect(casalMatchesBeforeAna.json().matches).toHaveLength(0);

    const faculdadeMatchesBeforeAna = await app.inject({
      method: 'GET',
      url: `/api/groups/${faculdadeGroupId}/matches`,
    });
    expect(faculdadeMatchesBeforeAna.json().matches).toHaveLength(0);

    // 2.2. Ana dá swipe positivo em Dune (438631)
    // Esse único voto deve completar o quórum de "Casal" (2/2 unânime) E "Galera da Faculdade" (2/3 maioria)
    const anaDuneRes = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': userAna },
      payload: {
        movieId: movieDune.tmdbId,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });
    expect(anaDuneRes.statusCode).toBe(201);
    const anaDuneBody = anaDuneRes.json();
    expect(anaDuneBody.matchesGenerated).toHaveLength(2);
    expect(anaDuneBody.matchesGenerated).toContain(casalGroupId);
    expect(anaDuneBody.matchesGenerated).toContain(faculdadeGroupId);

    // 2.3. Inspeciona a Watchlist Consensual do Grupo "Casal"
    const casalMatchesRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${casalGroupId}/matches?enriched=true`,
    });
    expect(casalMatchesRes.statusCode).toBe(200);
    const casalMatches = casalMatchesRes.json().matches;
    expect(casalMatches).toHaveLength(1);
    expect(casalMatches[0].match.movieId).toBe(movieDune.tmdbId);
    expect(casalMatches[0].match.quorumLevel).toBe(QuorumLevel.PERFECT);
    expect(casalMatches[0].match.positiveVotesCount).toBe(2);
    expect(casalMatches[0].match.status).toBe(MatchStatus.ACTIVE);
    expect(casalMatches[0].movie.title).toBe(movieDune.title);
    expect(casalMatches[0].voters).toHaveLength(2);

    // 2.4. Inspeciona a Watchlist Consensual do Grupo "Galera da Faculdade"
    const faculdadeMatchesRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${faculdadeGroupId}/matches?enriched=true`,
    });
    expect(faculdadeMatchesRes.statusCode).toBe(200);
    const faculdadeMatches = faculdadeMatchesRes.json().matches;
    expect(faculdadeMatches).toHaveLength(1);
    expect(faculdadeMatches[0].match.movieId).toBe(movieDune.tmdbId);
    expect(faculdadeMatches[0].match.quorumLevel).toBe(QuorumLevel.MINIMUM); // 2 de 3 votos atinge limiar de maioria
    expect(faculdadeMatches[0].match.positiveVotesCount).toBe(2);
    expect(faculdadeMatches[0].match.status).toBe(MatchStatus.ACTIVE);

    // 2.5. Valida que Alien permanece pendente (somente Pedro votou) e não vaza para nenhum grupo
    const alienCasalCheck = casalMatches.find((m: any) => m.match.movieId === movieAlien.tmdbId);
    expect(alienCasalCheck).toBeUndefined();
    const alienFaculdadeCheck = faculdadeMatches.find((m: any) => m.match.movieId === movieAlien.tmdbId);
    expect(alienFaculdadeCheck).toBeUndefined();

    // =========================================================================
    // ETAPA 3: Pipeline Assíncrono de Eventos e Notificações Push
    // =========================================================================

    // 3.1. Verifica eventos emitidos para "Casal"
    const casalEventsRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${casalGroupId}/events`,
    });
    expect(casalEventsRes.statusCode).toBe(200);
    const casalEvents = casalEventsRes.json().events;
    expect(casalEvents).toHaveLength(1);
    expect(casalEvents[0].movieId).toBe(movieDune.tmdbId);
    expect(casalEvents[0].movieTitle).toBe(movieDune.title);
    expect(casalEvents[0].quorumLevel).toBe(QuorumLevel.PERFECT);

    // 3.2. Verifica eventos emitidos para "Galera da Faculdade"
    const faculdadeEventsRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${faculdadeGroupId}/events`,
    });
    expect(faculdadeEventsRes.statusCode).toBe(200);
    const faculdadeEvents = faculdadeEventsRes.json().events;
    expect(faculdadeEvents).toHaveLength(1);
    expect(faculdadeEvents[0].movieId).toBe(movieDune.tmdbId);
    expect(faculdadeEvents[0].movieTitle).toBe(movieDune.title);

    // 3.3. Verifica notificações despachadas no serviço de push
    const dispatched = await notificationService.getDispatchedHistory();
    expect(dispatched.length).toBe(5);
    const casalRecipients = dispatched
      .filter((d) => d.groupId === casalGroupId)
      .map((d) => d.recipientUserId);
    expect(casalRecipients).toEqual(expect.arrayContaining([userPedro, userAna]));

    const faculdadeRecipients = dispatched
      .filter((d) => d.groupId === faculdadeGroupId)
      .map((d) => d.recipientUserId);
    expect(faculdadeRecipients).toEqual(
      expect.arrayContaining([userPedro, userAna, userLucas]),
    );

    // =========================================================================
    // ETAPA 4: Verificação Estrita do Invariante de Privacidade (Votos SKIPPED)
    // =========================================================================

    // 4.1. Lucas dá swipe negativo (SKIPPED) em Dune (438631)
    const lucasSkipRes = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': userLucas },
      payload: {
        movieId: movieDune.tmdbId,
        status: PreferenceStatus.SKIPPED,
      },
    });
    expect(lucasSkipRes.statusCode).toBe(201);
    expect(lucasSkipRes.json().matchesGenerated).toHaveLength(0);

    // 4.2. O match na "Galera da Faculdade" NÃO é quebrado, pois 2 de 3 continuam querendo assistir
    const faculdadeMatchesAfterSkip = await app.inject({
      method: 'GET',
      url: `/api/groups/${faculdadeGroupId}/matches?enriched=true`,
    });
    expect(faculdadeMatchesAfterSkip.statusCode).toBe(200);
    const matchesAfterSkip = faculdadeMatchesAfterSkip.json().matches;
    expect(matchesAfterSkip).toHaveLength(1);
    expect(matchesAfterSkip[0].match.movieId).toBe(movieDune.tmdbId);
    expect(matchesAfterSkip[0].match.positiveVotesCount).toBe(2);
    expect(matchesAfterSkip[0].match.status).toBe(MatchStatus.ACTIVE);

    // 4.3. O voto SKIPPED de Lucas JAMAIS aparece nos detalhes ou na lista de votantes
    const votersAfterSkip = matchesAfterSkip[0].voters.map((v: any) => v.id);
    expect(votersAfterSkip).toEqual(expect.arrayContaining([userPedro, userAna]));
    expect(votersAfterSkip).not.toContain(userLucas);

    // 4.4. Nenhum evento sobre a rejeição de Lucas foi emitido no barramento da sala
    const faculdadeEventsAfterSkip = await app.inject({
      method: 'GET',
      url: `/api/groups/${faculdadeGroupId}/events`,
    });
    const eventsAfterSkip = faculdadeEventsAfterSkip.json().events;
    expect(eventsAfterSkip).toHaveLength(1); // Continua apenas o evento original de match positivo

    // 4.5. Na watchlist pessoal de Lucas, Dune NÃO é listado (pois foi SKIPPED)
    const lucasWatchlistRes = await app.inject({
      method: 'GET',
      url: '/api/users/me/watchlist',
      headers: { 'x-user-id': userLucas },
    });
    expect(lucasWatchlistRes.statusCode).toBe(200);
    expect(lucasWatchlistRes.json().items).toHaveLength(0);

    // =========================================================================
    // ETAPA 5: Ciclo de Vida do Match: Agendamento & Conclusão de Sessão Conjunta
    // =========================================================================

    const duneMatchCasalId: string = casalMatches[0].match.id;

    // 5.1. Pedro agenda uma sessão no grupo "Casal" para assistir Dune
    const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Amanhã
    const scheduleRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${casalGroupId}/matches/${duneMatchCasalId}/schedule`,
      payload: {
        scheduledAt: scheduledDate.toISOString(),
        notes: 'Sessão de cinema sexta-feira com pipoca doce!',
      },
    });
    expect(scheduleRes.statusCode).toBe(201);
    const scheduleBody = scheduleRes.json();
    expect(scheduleBody.success).toBe(true);
    expect(scheduleBody.match.status).toBe(MatchStatus.SCHEDULED);
    const sessionId: string = scheduleBody.session.id;
    expect(sessionId).toBeDefined();

    // 5.2. Verifica que na lista de matches o status agora é SCHEDULED
    const casalMatchesScheduled = await app.inject({
      method: 'GET',
      url: `/api/groups/${casalGroupId}/matches`,
    });
    expect(casalMatchesScheduled.json().matches[0].status).toBe(MatchStatus.SCHEDULED);

    // 5.3. Conclusão da sessão conjunta com participantes Pedro e Ana
    const completeRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${casalGroupId}/sessions/${sessionId}/complete`,
      payload: {
        participantIds: [userPedro, userAna],
      },
    });
    expect(completeRes.statusCode).toBe(200);
    const completeBody = completeRes.json();
    expect(completeBody.success).toBe(true);
    expect(completeBody.match.status).toBe(MatchStatus.WATCHED);
    expect(completeBody.session.completedAt).not.toBeNull();

    // 5.4. Consulta o histórico compartilhado do grupo "Casal"
    const casalHistoryRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${casalGroupId}/history`,
    });
    expect(casalHistoryRes.statusCode).toBe(200);
    const historyBody = casalHistoryRes.json();
    expect(historyBody.total).toBe(1);
    expect(historyBody.stats.totalMoviesWatched).toBe(1);
    expect(historyBody.stats.totalRuntimeMinutes).toBe(155);
    expect(historyBody.stats.totalRuntimeFormatted).toBe('2h 35m');
    expect(historyBody.history[0].movie.title).toBe(movieDune.title);
    expect(historyBody.history[0].participants).toHaveLength(2);

    // =========================================================================
    // ETAPA 6: Roleta de Sorteio de Desempate Multi-Match
    // =========================================================================

    // 6.1. Pedro e Ana também dão WANT_TO_WATCH em Interstellar (157336)
    // Isso cria um segundo match na "Galera da Faculdade" (Pedro + Ana = 2/3)
    await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': userPedro },
      payload: {
        movieId: movieInterstellar.tmdbId,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });

    const anaInterstellarRes = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': userAna },
      payload: {
        movieId: movieInterstellar.tmdbId,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });
    expect(anaInterstellarRes.json().matchesGenerated).toContain(faculdadeGroupId);

    // 6.2. Verifica que a "Galera da Faculdade" tem 2 matches ativos para desempate
    const faculdadeTwoMatchesRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${faculdadeGroupId}/matches`,
    });
    const activeFaculdadeMatches = faculdadeTwoMatchesRes.json().matches;
    expect(activeFaculdadeMatches).toHaveLength(2);
    const duneMatchFaculdade = activeFaculdadeMatches.find((m: any) => m.movieId === movieDune.tmdbId);
    const interstellarMatchFaculdade = activeFaculdadeMatches.find((m: any) => m.movieId === movieInterstellar.tmdbId);
    expect(duneMatchFaculdade).toBeDefined();
    expect(interstellarMatchFaculdade).toBeDefined();

    // 6.3. Aciona a roleta de desempate no modo uniforme entre os 2 filmes
    const rouletteRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${faculdadeGroupId}/roulette`,
      payload: {
        mode: 'uniform',
      },
    });
    expect(rouletteRes.statusCode).toBe(200);
    const rouletteBody = rouletteRes.json();
    expect(rouletteBody.success).toBe(true);
    expect(rouletteBody.mode).toBe('uniform');
    expect(rouletteBody.selectionProbability).toBe(0.5);
    expect([movieDune.tmdbId, movieInterstellar.tmdbId]).toContain(rouletteBody.movie.tmdbId);

    // 6.4. Aciona a roleta com filtro restrito de candidatos (apenas Interstellar)
    const filteredRouletteRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${faculdadeGroupId}/roulette`,
      payload: {
        candidateMatchIds: [interstellarMatchFaculdade.id],
        mode: 'uniform',
      },
    });
    expect(filteredRouletteRes.statusCode).toBe(200);
    const filteredRouletteBody = filteredRouletteRes.json();
    expect(filteredRouletteBody.movie.tmdbId).toBe(movieInterstellar.tmdbId);
    expect(filteredRouletteBody.selectionProbability).toBe(1.0);
  });
});
