import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateSpinPhysics,
  pickFairRandom,
} from '../../core/algorithms/FairRandomPicker.js';
import { EnrichedGroupMatch } from '../components/MatchList/ConsensualMatchCard.js';

export interface RouletteModalProps {
  readonly isOpen: boolean;
  readonly matches: readonly EnrichedGroupMatch[];
  readonly groupName?: string | undefined;
  readonly onClose: () => void;
  readonly onConfirmMovie?: ((match: EnrichedGroupMatch) => void | Promise<void>) | undefined;
  readonly onScheduleMovie?: ((match: EnrichedGroupMatch) => void) | undefined;
  readonly onSpinStart?: (() => void) | undefined;
  readonly onSpinComplete?: ((winner: EnrichedGroupMatch) => void) | undefined;
  readonly onHapticTick?: (() => void) | undefined;
  readonly customSpinDurationMs?: number | undefined;
  readonly predeterminedWinnerIndex?: number | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly testId?: string | undefined;
}

const SEGMENT_COLORS = [
  '#ef4444', // Vermelho vibrante
  '#3b82f6', // Azul royal
  '#10b981', // Verde esmeralda
  '#f59e0b', // Âmbar
  '#8b5cf6', // Roxo
  '#ec4899', // Rosa pink
  '#06b6d4', // Ciano
  '#84cc16', // Lima
  '#f97316', // Laranja
  '#6366f1', // Índigo
];

export function getSegmentColor(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length]!;
}

export function buildSvgWheelSlices(
  total: number,
  radius: number = 140,
): readonly { path: string; labelAngle: number }[] {
  if (total <= 0) return [];
  if (total === 1) {
    return [{ path: `M 0 0`, labelAngle: 0 }];
  }

  const segmentAngleRad = (2 * Math.PI) / total;
  const slices: { path: string; labelAngle: number }[] = [];

  for (let i = 0; i < total; i++) {
    // Começa no topo (-PI / 2)
    const startAngle = i * segmentAngleRad - Math.PI / 2;
    const endAngle = (i + 1) * segmentAngleRad - Math.PI / 2;

    const x1 = radius * Math.cos(startAngle);
    const y1 = radius * Math.sin(startAngle);
    const x2 = radius * Math.cos(endAngle);
    const y2 = radius * Math.sin(endAngle);

    const largeArc = segmentAngleRad > Math.PI ? 1 : 0;
    const path = `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    const labelAngle = (i * 360) / total + 180 / total;

    slices.push({ path, labelAngle });
  }

  return slices;
}

export const RouletteModal: React.FC<RouletteModalProps> = ({
  isOpen,
  matches,
  groupName,
  onClose,
  onConfirmMovie,
  onScheduleMovie,
  onSpinStart,
  onSpinComplete,
  onHapticTick,
  customSpinDurationMs,
  predeterminedWinnerIndex,
  style,
  testId = 'roulette-modal',
}) => {
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [selectedMatch, setSelectedMatch] = useState<EnrichedGroupMatch | null>(null);
  const [isCelebrating, setIsCelebrating] = useState<boolean>(false);

  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Limpa timers ao desmontar ou fechar
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((t) => clearTimeout(t));
      timeoutRefs.current = [];
    };
  }, []);

  // Reseta estado quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setIsSpinning(false);
      setRotationDegrees(0);
      setSelectedMatch(null);
      setIsCelebrating(false);
    }
  }, [isOpen]);

  const activeMatches = useMemo(() => {
    return matches.filter((m) => m.match.status === 'ACTIVE');
  }, [matches]);

  const totalCandidates = activeMatches.length;
  const durationMs = customSpinDurationMs ?? 3500;

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10);
      }
    } catch {
      // Ignora falhas de ambiente sem vibração
    }
    onHapticTick?.();
  };

  const handleSpin = () => {
    if (isSpinning || totalCandidates === 0) return;

    // Cancela timers anteriores
    timeoutRefs.current.forEach((t) => clearTimeout(t));
    timeoutRefs.current = [];

    setIsCelebrating(false);
    setSelectedMatch(null);
    setIsSpinning(true);
    onSpinStart?.();

    // Determina o vencedor via FairRandomPicker ou pré-determinado para testes
    let winnerIndex = 0;
    if (
      typeof predeterminedWinnerIndex === 'number' &&
      predeterminedWinnerIndex >= 0 &&
      predeterminedWinnerIndex < totalCandidates
    ) {
      winnerIndex = predeterminedWinnerIndex;
    } else {
      const candidatesWithWeights = activeMatches.map((m) => ({
        id: m.match.id,
        weight: m.match.positiveVotesCount,
      }));
      const pick = pickFairRandom(candidatesWithWeights, { mode: 'uniform' });
      winnerIndex = pick.selectedIndex;
    }

    const winnerMatch = activeMatches[winnerIndex]!;

    // Calcula física de giro e desaceleração
    const physics = calculateSpinPhysics({
      targetIndex: winnerIndex,
      totalItems: totalCandidates,
      totalDurationMs: durationMs,
      minSpins: 5,
    });

    // Inicia rotação
    setRotationDegrees(physics.totalRotationDegrees);

    // Agenda os ticks hápticos
    for (const tMs of physics.tickTimestampsMs) {
      const timer = setTimeout(() => {
        triggerHaptic();
      }, tMs);
      timeoutRefs.current.push(timer);
    }

    // Ao terminar o giro
    const finishTimer = setTimeout(() => {
      setIsSpinning(false);
      setSelectedMatch(winnerMatch);
      setIsCelebrating(true);
      triggerHaptic();
      onSpinComplete?.(winnerMatch);
    }, durationMs + 50);

    timeoutRefs.current.push(finishTimer);
  };

  if (!isOpen) {
    return null;
  }

  const slices = buildSvgWheelSlices(totalCandidates, 130);

  return (
    <div
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roulette-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Backdrop */}
      <div
        data-testid="roulette-backdrop"
        onClick={!isSpinning ? onClose : undefined}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 15, 30, 0.85)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Conteúdo do Modal */}
      <div
        data-testid="roulette-container"
        style={{
          position: 'relative',
          zIndex: 1101,
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#1e293b',
          borderRadius: 24,
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#f8fafc',
          padding: '24px 20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div>
            <h2
              id="roulette-modal-title"
              data-testid="roulette-title"
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🎲</span>
              <span>Roleta de Desempate</span>
            </h2>
            <span
              style={{
                fontSize: 12,
                color: '#94a3b8',
              }}
            >
              {groupName ? `${groupName} • ` : ''}
              {totalCandidates === 1
                ? '1 filme consensual'
                : `${totalCandidates} filmes consensuais`}
            </span>
          </div>

          <button
            type="button"
            data-testid="roulette-close-button"
            disabled={isSpinning}
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 22,
              cursor: isSpinning ? 'not-allowed' : 'pointer',
              padding: 4,
              lineHeight: 1,
              opacity: isSpinning ? 0.4 : 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Cenário com menos de 1 match */}
        {totalCandidates === 0 && (
          <div
            data-testid="roulette-empty-notice"
            style={{
              padding: '30px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 36 }}>🍿</span>
            <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', maxWidth: 300 }}>
              Não há filmes consensuais ativos na watchlist do grupo no momento para sortear.
            </p>
          </div>
        )}

        {/* Roleta Visual Circular */}
        {totalCandidates > 0 && (
          <div
            style={{
              position: 'relative',
              width: 280,
              height: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '8px 0',
            }}
          >
            {/* Ponteiro Indicador Superior */}
            <div
              data-testid="roulette-pointer"
              style={{
                position: 'absolute',
                top: -8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 30,
                width: 0,
                height: 0,
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderTop: '22px solid #fbbf24',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))',
              }}
            />

            {/* Roda Giratória */}
            <div
              data-testid="roulette-wheel"
              style={{
                width: 270,
                height: 270,
                borderRadius: '50%',
                border: isCelebrating
                  ? '6px solid #fbbf24'
                  : '6px solid #334155',
                boxShadow: isCelebrating
                  ? '0 0 25px rgba(251, 191, 36, 0.6)'
                  : '0 8px 24px rgba(0, 0, 0, 0.5)',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#0f172a',
                transition: isSpinning
                  ? `transform ${durationMs}ms cubic-bezier(0.12, 0.8, 0.25, 1)`
                  : 'none',
                transform: `rotate(${rotationDegrees}deg)`,
              }}
            >
              <svg
                viewBox="-140 -140 280 280"
                style={{ width: '100%', height: '100%' }}
              >
                {slices.map((slice, i) => (
                  <path
                    key={activeMatches[i]?.match.id ?? i}
                    d={slice.path}
                    fill={getSegmentColor(i)}
                    stroke="#1e293b"
                    strokeWidth="2"
                  />
                ))}
              </svg>

              {/* Rótulos dos Títulos nos Segmentos */}
              {slices.map((slice, i) => {
                const match = activeMatches[i];
                if (!match) return null;
                const truncatedTitle =
                  match.movie.title.length > 12
                    ? `${match.movie.title.substring(0, 10)}...`
                    : match.movie.title;

                return (
                  <div
                    key={`label-${match.match.id}`}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: 100,
                      height: 20,
                      marginLeft: -50,
                      marginTop: -10,
                      transform: `rotate(${slice.labelAngle}deg) translate(70px)`,
                      transformOrigin: 'center center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#ffffff',
                        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {truncatedTitle}
                    </span>
                  </div>
                );
              })}

              {/* Centro da Roda */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  backgroundColor: '#0f172a',
                  border: '3px solid #fbbf24',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 20,
                }}
              >
                <span style={{ fontSize: 18 }}>🍿</span>
              </div>
            </div>
          </div>
        )}

        {/* Efeito de Celebração e Card do Filme Sorteado */}
        {isCelebrating && selectedMatch && (
          <div
            data-testid="roulette-winner-card"
            style={{
              width: '100%',
              backgroundColor: '#0f172a',
              borderRadius: 16,
              border: '2px solid #fbbf24',
              padding: '14px 16px',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 10px 25px -5px rgba(251, 191, 36, 0.3)',
              animation: 'fadeIn 0.3s ease-in-out',
            }}
          >
            {selectedMatch.movie.posterPath ? (
              <img
                src={selectedMatch.movie.posterPath}
                alt={selectedMatch.movie.title}
                data-testid="winner-movie-poster"
                style={{
                  width: 48,
                  height: 72,
                  borderRadius: 8,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 72,
                  borderRadius: 8,
                  backgroundColor: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                🎬
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fbbf24',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 2,
                }}
              >
                🎉 Filme Escolhido!
              </div>

              <h4
                data-testid="winner-movie-title"
                style={{
                  margin: '0 0 4px 0',
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#ffffff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedMatch.movie.title}
              </h4>

              <div
                style={{
                  fontSize: 12,
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>⭐ {selectedMatch.movie.voteAverage?.toFixed(1) ?? 'N/A'}</span>
                <span>•</span>
                <span>{selectedMatch.match.positiveVotesCount} votos</span>
              </div>
            </div>
          </div>
        )}

        {/* Barra de Ações */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '100%',
            marginTop: 4,
          }}
        >
          {/* Botão de Girar Roleta */}
          {(!isCelebrating || isSpinning) && (
            <button
              type="button"
              data-testid="roulette-spin-button"
              disabled={isSpinning || totalCandidates === 0}
              onClick={handleSpin}
              style={{
                width: '100%',
                backgroundColor: isSpinning ? '#334155' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '14px',
                fontSize: 15,
                fontWeight: 700,
                cursor: isSpinning || totalCandidates === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: isSpinning ? 'none' : '0 10px 15px -3px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              <span>{isSpinning ? 'Girando...' : 'Girar Roleta de Desempate 🎲'}</span>
            </button>
          )}

          {/* Ações Pós-Sorteio (Celebração) */}
          {isCelebrating && selectedMatch && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                {onConfirmMovie && (
                  <button
                    type="button"
                    data-testid="roulette-watch-now-button"
                    onClick={() => {
                      onConfirmMovie(selectedMatch);
                      onClose();
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 12,
                      padding: '12px',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>▶</span>
                    <span>Assistir Agora</span>
                  </button>
                )}

                {onScheduleMovie && (
                  <button
                    type="button"
                    data-testid="roulette-schedule-button"
                    onClick={() => {
                      onScheduleMovie(selectedMatch);
                      onClose();
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 12,
                      padding: '12px',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>📅</span>
                    <span>Agendar Sessão</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                data-testid="roulette-spin-again-button"
                onClick={handleSpin}
                style={{
                  width: '100%',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  borderRadius: 12,
                  padding: '10px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>↺</span>
                <span>Girar Novamente</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
