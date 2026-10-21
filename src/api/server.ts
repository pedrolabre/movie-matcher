import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import { CatalogService } from '../core/services/CatalogService.js';
import { PreferenceService } from '../core/services/PreferenceService.js';
import { GroupService } from '../core/services/GroupService.js';
import { MatchIntersectionEngine } from '../core/services/MatchIntersectionEngine.js';
import {
  InMemoryMatchRepository,
  MatchRepository,
} from '../infrastructure/database/repositories/MatchRepository.js';
import {
  InMemorySessionRepository,
  SessionRepository,
} from '../infrastructure/database/repositories/SessionRepository.js';
import { InMemoryPreferenceRepository } from '../infrastructure/database/repositories/PreferenceRepository.js';
import {
  InMemoryMatchEventEmitter,
  MatchEventBus,
} from '../infrastructure/events/MatchEventEmitter.js';
import { PushNotificationService } from '../infrastructure/notifications/PushNotificationService.js';
import { TmdbApiError, TmdbRateLimitError } from '../infrastructure/tmdb/types.js';
import { SessionService } from '../core/services/SessionService.js';
import { moviesRoutes } from './routes/movies.routes.js';
import { preferencesRoutes } from './routes/preferences.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { groupsRoutes } from './routes/groups.routes.js';
import { eventsRoutes } from './routes/events.routes.js';
import { sessionsRoutes } from './routes/sessions.routes.js';
import { rouletteRoutes } from './routes/roulette.routes.js';

export interface BuildAppOptions extends FastifyServerOptions {
  catalogService?: CatalogService;
  preferenceService?: PreferenceService;
  groupService?: GroupService;
  matchRepository?: MatchRepository;
  sessionRepository?: SessionRepository;
  sessionService?: SessionService;
  matchIntersectionEngine?: MatchIntersectionEngine;
  matchEventBus?: MatchEventBus;
  notificationService?: PushNotificationService;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const catalogService = options.catalogService ?? new CatalogService();
  const groupService = options.groupService ?? new GroupService();
  const matchRepository = options.matchRepository ?? new InMemoryMatchRepository();
  const matchEventBus = options.matchEventBus ?? new InMemoryMatchEventEmitter();
  const notificationService =
    options.notificationService ?? new PushNotificationService();
  const sessionRepository =
    options.sessionRepository ?? new InMemorySessionRepository();
  const sessionService =
    options.sessionService ??
    new SessionService(
      sessionRepository,
      matchRepository,
      groupService.getRepository(),
      catalogService,
    );

  let preferenceService = options.preferenceService;
  let matchIntersectionEngine = options.matchIntersectionEngine;

  if (!matchIntersectionEngine) {
    const preferenceRepo =
      preferenceService?.getRepository() ?? new InMemoryPreferenceRepository();
    const groupRepo = groupService.getRepository();
    matchIntersectionEngine = new MatchIntersectionEngine(
      preferenceRepo,
      groupRepo,
      matchRepository,
      matchEventBus,
      notificationService,
      catalogService,
    );
  }

  if (!preferenceService) {
    const preferenceRepo = new InMemoryPreferenceRepository();
    const engineToUse =
      options.matchIntersectionEngine ??
      new MatchIntersectionEngine(
        preferenceRepo,
        groupService.getRepository(),
        matchRepository,
        matchEventBus,
        notificationService,
        catalogService,
      );

    preferenceService = new PreferenceService(
      preferenceRepo,
      catalogService,
      engineToUse,
    );
    matchIntersectionEngine = engineToUse;
  }

  const {
    catalogService: _,
    preferenceService: __,
    groupService: ___,
    matchRepository: ____,
    sessionRepository: _____,
    sessionService: ______,
    matchIntersectionEngine: _______,
    matchEventBus: ________,
    notificationService: _________,
    ...fastifyOptions
  } = options;

  const app = fastify(fastifyOptions);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.issues.map((issue) => issue.message).join('; '),
        issues: error.issues,
      });
    }

    if (error instanceof TmdbRateLimitError) {
      if (error.retryAfterSeconds !== null) {
        reply.header('Retry-After', String(error.retryAfterSeconds));
      }
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: error.message,
      });
    }

    if (error instanceof TmdbApiError) {
      const statusCode =
        error.statusCode === 404
          ? 404
          : error.statusCode >= 400 && error.statusCode < 600
            ? error.statusCode
            : 500;
      return reply.status(statusCode).send({
        statusCode,
        error: statusCode === 404 ? 'Not Found' : 'TMDB API Error',
        message: statusCode === 404 ? 'Movie not found' : error.message,
      });
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as { statusCode?: number; name?: string; message?: string };
      if (typeof err.statusCode === 'number') {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name || 'Error',
          message: err.message || 'Error occurred',
        });
      }
    }

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  });

  app.register(moviesRoutes, {
    prefix: '/api/movies',
    catalogService,
  });

  app.register(preferencesRoutes, {
    prefix: '/api/preferences',
    preferenceService,
  });

  app.register(usersRoutes, {
    prefix: '/api/users',
    preferenceService,
  });

  app.register(groupsRoutes, {
    prefix: '/api/groups',
    groupService,
    matchIntersectionEngine,
  });

  app.register(eventsRoutes, {
    prefix: '/api/groups',
    groupService,
    eventBus: matchEventBus,
  });

  app.register(sessionsRoutes, {
    prefix: '/api/groups',
    sessionService,
  });

  if (matchIntersectionEngine) {
    app.register(rouletteRoutes, {
      prefix: '/api/groups',
      groupService,
      matchIntersectionEngine,
    });
  }

  return app;
}

export async function startServer(port = 3000, host = '0.0.0.0'): Promise<FastifyInstance> {
  const app = buildApp({ logger: true });
  await app.listen({ port, host });
  return app;
}
