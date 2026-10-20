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
│   │   │   ├── events.routes.ts
│   │   │   ├── groups.routes.ts
│   │   │   ├── movies.routes.ts
│   │   │   ├── preferences.routes.ts
│   │   │   ├── sessions.routes.ts
│   │   │   └── users.routes.ts
│   │   └── server.ts
│   ├── core/
│   │   ├── algorithms/
│   │   │   └── QuorumEvaluator.ts
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
│   │   ├── services/
│   │   │   ├── CatalogService.ts
│   │   │   ├── GroupService.ts
│   │   │   ├── MatchIntersectionEngine.ts
│   │   │   ├── PreferenceService.ts
│   │   │   └── SessionService.ts
│   │   └── utils/
│   │       └── inviteCode.ts
│   ├── infrastructure/
│   │   ├── cache/
│   │   │   ├── CacheService.ts
│   │   │   └── MemoryCacheService.ts
│   │   ├── database/
│   │   │   └── repositories/
│   │   │       ├── GroupRepository.ts
│   │   │       ├── MatchRepository.ts
│   │   │       ├── PreferenceRepository.ts
│   │   │       └── SessionRepository.ts
│   │   ├── events/
│   │   │   └── MatchEventEmitter.ts
│   │   ├── notifications/
│   │   │   └── PushNotificationService.ts
│   │   └── tmdb/
│   │       ├── mappers/
│   │       │   └── MovieMapper.ts
│   │       ├── TmdbClient.ts
│   │       └── types.ts
│   └── mobile/
│       ├── components/
│       │   ├── Group/
│       │   │   └── GroupCard.tsx
│       │   ├── MatchList/
│       │   │   ├── ConsensualMatchCard.tsx
│       │   │   └── VoterAvatarStack.tsx
│       │   ├── SwipeDeck/
│       │   │   ├── MovieCard.tsx
│       │   │   ├── SwipeDeck.tsx
│       │   │   └── useSwipeGesture.ts
│       │   ├── Watchlist/
│       │   │   └── MovieGridCard.tsx
│       │   └── GroupStatsHeader.tsx
│       ├── modals/
│       │   └── ScheduleSessionModal.tsx
│       ├── screens/
│       │   ├── GroupHistoryScreen.tsx
│       │   ├── GroupListScreen.tsx
│       │   ├── GroupWatchlistScreen.tsx
│       │   ├── PersonalHistoryScreen.tsx
│       │   └── PersonalWatchlistScreen.tsx
│       └── stores/
│           └── useDeckStore.ts
├── tests/
│   ├── integration/
│   │   ├── eventsRoutes.test.ts
│   │   ├── groupHistory.test.ts
│   │   ├── groupsRoutes.test.ts
│   │   ├── matchIntersection.test.ts
│   │   ├── moviesRoutes.test.ts
│   │   ├── preferencesRoutes.test.ts
│   │   ├── sessionsRoutes.test.ts
│   │   └── userLists.test.ts
│   └── unit/
│       ├── CatalogService.test.ts
│       ├── ConsensualMatchCard.test.ts
│       ├── domainSchemas.test.ts
│       ├── GroupCard.test.ts
│       ├── GroupHistoryScreen.test.ts
│       ├── GroupListScreen.test.ts
│       ├── GroupService.test.ts
│       ├── GroupStatsHeader.test.ts
│       ├── GroupWatchlistScreen.test.ts
│       ├── inviteCode.test.ts
│       ├── MatchEventEmitter.test.ts
│       ├── MatchIntersectionEngine.test.ts
│       ├── MovieGridCard.test.ts
│       ├── MovieMapper.test.ts
│       ├── PersonalListsScreens.test.ts
│       ├── PreferenceService.test.ts
│       ├── PushNotificationService.test.ts
│       ├── QuorumEvaluator.test.ts
│       ├── ScheduleSessionModal.test.ts
│       ├── SessionService.test.ts
│       ├── TmdbClient.test.ts
│       ├── useDeckStore.test.ts
│       └── VoterAvatarStack.test.ts
└── README.md
```
