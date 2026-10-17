# movie-matcher

> A preferência pertence ao usuário. O match pertence ao grupo.

Uma plataforma social privada de decisão em grupo desenvolvida em React Native (Expo) + Fastify + PostgreSQL + Redis que resolve o atrito de escolher o que assistir entre amigos e casais, cruzando preferências individuais em segundo plano para gerar watchlists consensuais sem expor rejeições e sem a toxicidade de feeds públicos.

---

## Estrutura do Projeto

```text
movie-matcher/
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── movies.routes.ts
│   │   │   └── preferences.routes.ts
│   │   └── server.ts
│   ├── core/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── Group.ts
│   │   │   │   ├── GroupMember.ts
│   │   │   │   ├── GroupMovieMatch.ts
│   │   │   │   ├── GroupWatchSession.ts
│   │   │   │   ├── Movie.ts
│   │   │   │   ├── User.ts
│   │   │   │   └── UserMoviePreference.ts
│   │   │   ├── enums/
│   │   │   │   ├── GroupRole.ts
│   │   │   │   ├── MatchStatus.ts
│   │   │   │   ├── PreferenceStatus.ts
│   │   │   │   ├── QuorumLevel.ts
│   │   │   │   └── QuorumRule.ts
│   │   │   └── types/
│   │   │       └── schemas.ts
│   │   └── services/
│   │       ├── CatalogService.ts
│   │       └── PreferenceService.ts
│   └── infrastructure/
│       ├── cache/
│       │   ├── CacheService.ts
│       │   └── MemoryCacheService.ts
│       ├── database/
│       │   └── repositories/
│       │       └── PreferenceRepository.ts
│       └── tmdb/
│           ├── mappers/
│           │   └── MovieMapper.ts
│           ├── TmdbClient.ts
│           └── types.ts
├── tests/
│   ├── integration/
│   │   ├── moviesRoutes.test.ts
│   │   └── preferencesRoutes.test.ts
│   └── unit/
│       ├── CatalogService.test.ts
│       ├── domainSchemas.test.ts
│       ├── MovieMapper.test.ts
│       ├── PreferenceService.test.ts
│       └── TmdbClient.test.ts
└── README.md
```
