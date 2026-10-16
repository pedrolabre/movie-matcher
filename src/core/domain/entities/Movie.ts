export interface MovieGenre {
  readonly id: number;
  readonly name: string;
}

export interface StreamingProvider {
  readonly providerId: number;
  readonly providerName: string;
  readonly logoPath?: string | null;
}

export interface Movie {
  readonly tmdbId: number;
  readonly title: string;
  readonly originalTitle?: string | null;
  readonly overview?: string | null;
  readonly posterPath?: string | null;
  readonly backdropPath?: string | null;
  readonly releaseYear?: number | null;
  readonly runtimeMinutes?: number | null;
  readonly voteAverage?: number | null;
  readonly genres: readonly MovieGenre[];
  readonly streamingProviders: readonly StreamingProvider[];
  readonly syncedAt: Date;
}
