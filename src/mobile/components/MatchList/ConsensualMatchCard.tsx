import React from 'react';
import { Movie } from '../../../core/domain/entities/Movie.js';
import { GroupMovieMatch } from '../../../core/domain/entities/GroupMovieMatch.js';
import { MatchStatus } from '../../../core/domain/enums/MatchStatus.js';
import { QuorumLevel } from '../../../core/domain/enums/QuorumLevel.js';
import { VoterAvatarStack, VoterProfile } from './VoterAvatarStack.js';

export interface EnrichedGroupMatch {
  readonly match: GroupMovieMatch;
  readonly movie: Movie;
  readonly voters: readonly VoterProfile[];
  readonly memberCount?: number | undefined;
}

export interface QuorumBadgeInfo {
  readonly label: string;
  readonly bg: string;
  readonly color: string;
  readonly border: string;
  readonly ratioText: string;
  readonly description: string;
}

export interface MatchStatusBadgeInfo {
  readonly label: string;
  readonly bg: string;
  readonly color: string;
}

export interface ConsensualMatchCardProps {
  readonly match: EnrichedGroupMatch;
  readonly onSchedule?: ((match: EnrichedGroupMatch) => void | Promise<void>) | undefined;
  readonly onWatchNow?: ((match: EnrichedGroupMatch) => void | Promise<void>) | undefined;
  readonly onPress?: ((match: EnrichedGroupMatch) => void) | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly testId?: string | undefined;
}

const DEFAULT_POSTER_FALLBACK =
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80';

export function formatQuorumBadge(
  quorumLevel: QuorumLevel,
  positiveVotesCount: number,
  memberCount?: number,
): QuorumBadgeInfo {
  const ratioText =
    typeof memberCount === 'number' && memberCount > 0
      ? `${positiveVotesCount}/${memberCount}`
      : `${positiveVotesCount} votos`;

  switch (quorumLevel) {
    case QuorumLevel.PERFECT:
      return {
        label: 'Consenso Perfeito',
        bg: 'rgba(16, 185, 129, 0.16)',
        color: '#10b981',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        ratioText,
        description: '100% dos membros toparam assistir',
      };
    case QuorumLevel.STRONG:
      return {
        label: 'Match Forte',
        bg: 'rgba(139, 92, 246, 0.16)',
        color: '#a78bfa',
        border: '1px solid rgba(139, 92, 246, 0.4)',
        ratioText,
        description: 'Forte adesão no grupo',
      };
    case QuorumLevel.MINIMUM:
    default:
      return {
        label: 'Combinação Encontrada',
        bg: 'rgba(59, 130, 246, 0.16)',
        color: '#60a5fa',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        ratioText,
        description: 'Quórum mínimo atingido',
      };
  }
}

export function formatMatchStatusBadge(status: MatchStatus): MatchStatusBadgeInfo {
  switch (status) {
    case MatchStatus.SCHEDULED:
      return {
        label: 'Sessão Agendada',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.16)',
      };
    case MatchStatus.WATCHED:
      return {
        label: 'Já Assistido',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.16)',
      };
    case MatchStatus.ARCHIVED:
      return {
        label: 'Arquivado',
        color: '#64748b',
        bg: 'rgba(100, 116, 139, 0.16)',
      };
    case MatchStatus.ACTIVE:
    default:
      return {
        label: 'Disponível',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.16)',
      };
  }
}

export const ConsensualMatchCard: React.FC<ConsensualMatchCardProps> = ({
  match,
  onSchedule,
  onWatchNow,
  onPress,
  style,
  testId = 'consensual-match-card',
}) => {
  const { movie, match: rawMatch, voters, memberCount } = match;
  const posterSource = movie.posterPath ?? DEFAULT_POSTER_FALLBACK;
  const quorumBadge = formatQuorumBadge(
    rawMatch.quorumLevel,
    rawMatch.positiveVotesCount,
    memberCount,
  );
  const statusBadge = formatMatchStatusBadge(rawMatch.status);

  const ratingText =
    typeof movie.voteAverage === 'number' && movie.voteAverage > 0
      ? movie.voteAverage.toFixed(1)
      : 'N/A';

  const handleCardClick = () => {
    onPress?.(match);
  };

  const handleSchedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSchedule?.(match);
  };

  const handleWatchNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWatchNow?.(match);
  };

  return (
    <div
      data-testid={testId}
      data-match-id={rawMatch.id}
      data-movie-id={movie.tmdbId}
      data-quorum-level={rawMatch.quorumLevel}
      aria-label={`Match de ${movie.title} - ${quorumBadge.label}`}
      onClick={handleCardClick}
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 16,
        border: '1px solid #334155',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        cursor: onPress ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
        ...style,
      }}
    >
      {/* Top Banner / Poster */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 200,
          backgroundColor: '#0f172a',
          overflow: 'hidden',
        }}
      >
        <img
          src={posterSource}
          alt={movie.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* Gradiente escuro no rodapé da imagem */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: 'linear-gradient(to top, rgba(30, 41, 59, 1) 0%, rgba(30, 41, 59, 0) 100%)',
          }}
        />

        {/* Badge de Nota */}
        <div
          data-testid="match-card-rating"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 8,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            fontSize: 12,
            fontWeight: 700,
            color: '#fbbf24',
          }}
        >
          <span>★</span>
          <span>{ratingText}</span>
        </div>

        {/* Badge de Quórum Flutuante */}
        <div
          data-testid="match-card-quorum-badge"
          title={quorumBadge.description}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 20,
            backgroundColor: quorumBadge.bg,
            border: quorumBadge.border,
            color: quorumBadge.color,
            fontSize: 12,
            fontWeight: 700,
            backdropFilter: 'blur(4px)',
          }}
        >
          <span>●</span>
          <span>{quorumBadge.label}</span>
          <span style={{ opacity: 0.85 }}>({quorumBadge.ratioText})</span>
        </div>
      </div>

      {/* Conteúdo do Card */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
        }}
      >
        {/* Título e Metadados Básicos */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h3
              data-testid="match-card-title"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#f8fafc',
                lineHeight: 1.3,
              }}
            >
              {movie.title}
            </h3>

            {rawMatch.status !== MatchStatus.ACTIVE && (
              <span
                data-testid="match-card-status-badge"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 6,
                  backgroundColor: statusBadge.bg,
                  color: statusBadge.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {statusBadge.label}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4,
              fontSize: 12,
              color: '#94a3b8',
            }}
          >
            {movie.releaseYear && <span>{movie.releaseYear}</span>}
            {movie.runtimeMinutes && (
              <>
                <span>•</span>
                <span>{movie.runtimeMinutes} min</span>
              </>
            )}
          </div>
        </div>

        {/* Gêneros */}
        {movie.genres.length > 0 && (
          <div
            data-testid="match-card-genres"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {movie.genres.slice(0, 3).map((genre) => (
              <span
                key={genre.id}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 6,
                  backgroundColor: '#334155',
                  color: '#cbd5e1',
                  fontWeight: 500,
                }}
              >
                {genre.name}
              </span>
            ))}
          </div>
        )}

        {/* Sinopse truncada */}
        {movie.overview && (
          <p
            data-testid="match-card-overview"
            style={{
              margin: 0,
              fontSize: 13,
              color: '#94a3b8',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {movie.overview}
          </p>
        )}

        {/* Divisor */}
        <div style={{ height: 1, backgroundColor: '#334155', margin: '4px 0' }} />

        {/* Seção de Votantes com VoterAvatarStack */}
        <div
          data-testid="match-card-voters-section"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <VoterAvatarStack
            voters={voters}
            totalMemberCount={memberCount}
            showCount={true}
            size={28}
          />
        </div>

        {/* Botões de Ação Rápida Pós-Match */}
        {(onSchedule || onWatchNow) && (
          <div
            data-testid="match-card-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 4,
            }}
          >
            {onSchedule && (
              <button
                type="button"
                data-testid="match-action-schedule"
                onClick={handleSchedule}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 10,
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  color: '#f8fafc',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span>📅</span>
                <span>{rawMatch.status === MatchStatus.SCHEDULED ? 'Reagendar' : 'Agendar'}</span>
              </button>
            )}

            {onWatchNow && (
              <button
                type="button"
                data-testid="match-action-watch-now"
                onClick={handleWatchNow}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 10,
                  backgroundColor: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span>▶</span>
                <span>{rawMatch.status === MatchStatus.SCHEDULED ? 'Marcar Assistido' : 'Vamos Assistir'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
