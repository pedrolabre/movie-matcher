import React, { useEffect, useState } from 'react';
import { EnrichedGroupMatch } from '../components/MatchList/ConsensualMatchCard.js';

export interface ScheduleSessionModalProps {
  readonly isOpen: boolean;
  readonly match: EnrichedGroupMatch | null;
  readonly onClose: () => void;
  readonly onConfirm: (data: { scheduledAt: Date; notes?: string | undefined }) => void | Promise<void>;
  readonly isLoading?: boolean | undefined;
  readonly testId?: string | undefined;
}

export function formatISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validateScheduleInput(
  dateStr: string,
  timeStr: string,
): { isValid: boolean; error?: string; scheduledDate?: Date } {
  if (!dateStr || dateStr.trim().length === 0) {
    return { isValid: false, error: 'Selecione uma data para a sessão' };
  }

  if (!timeStr || timeStr.trim().length === 0) {
    return { isValid: false, error: 'Selecione um horário para a sessão' };
  }

  const combined = new Date(`${dateStr}T${timeStr}`);
  if (isNaN(combined.getTime())) {
    return { isValid: false, error: 'Data ou horário inválidos' };
  }

  const now = new Date();
  const gracePeriodMs = 5 * 60 * 1000;
  if (combined.getTime() < now.getTime() - gracePeriodMs) {
    return {
      isValid: false,
      error: 'Data e horário da sessão não podem ser no passado',
    };
  }

  return { isValid: true, scheduledDate: combined };
}

export const ScheduleSessionModal: React.FC<ScheduleSessionModalProps> = ({
  isOpen,
  match,
  onClose,
  onConfirm,
  isLoading = false,
  testId = 'schedule-session-modal',
}) => {
  const [date, setDate] = useState<string>(() => formatISODate(new Date()));
  const [time, setTime] = useState<string>('20:00');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDate(formatISODate(new Date()));
      setTime('20:00');
      setNotes('');
      setErrorMessage(null);
    }
  }, [isOpen, match]);

  if (!isOpen || !match) {
    return null;
  }

  const minDate = formatISODate(new Date());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateScheduleInput(date, time);
    if (!validation.isValid || !validation.scheduledDate) {
      setErrorMessage(validation.error ?? 'Verifique os dados informados');
      return;
    }

    try {
      await onConfirm({
        scheduledAt: validation.scheduledDate,
        ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao agendar sessão de cinema';
      setErrorMessage(msg);
    }
  };

  return (
    <div
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <div
        data-testid="schedule-modal-backdrop"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
        }}
      />

      <div
        data-testid="schedule-modal-container"
        style={{
          position: 'relative',
          zIndex: 1001,
          width: '100%',
          maxWidth: 460,
          backgroundColor: '#1e293b',
          borderRadius: 20,
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: '#f8fafc',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              id="schedule-modal-title"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#ffffff',
              }}
            >
              Agendar Sessão de Cinema
            </h2>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              Marque o encontro para assistir com o grupo
            </span>
          </div>
          <button
            type="button"
            data-testid="schedule-modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 22,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderBottom: '1px solid #334155',
          }}
        >
          {match.movie.posterPath && (
            <img
              src={match.movie.posterPath}
              alt={match.movie.title}
              style={{
                width: 48,
                height: 72,
                borderRadius: 8,
                objectFit: 'cover',
              }}
            />
          )}
          <div>
            <h3
              data-testid="schedule-movie-title"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: '#ffffff',
              }}
            >
              {match.movie.title}
            </h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {match.movie.releaseYear ?? ''}
              {match.movie.runtimeMinutes ? ` • ${match.movie.runtimeMinutes} min` : ''}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {errorMessage && (
            <div
              data-testid="schedule-modal-error"
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                borderRadius: 10,
                color: '#fca5a5',
                fontSize: 13,
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="schedule-input-date" style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
                Data da Sessão
              </label>
              <input
                id="schedule-input-date"
                type="date"
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="schedule-input-date"
                required
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#ffffff',
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="schedule-input-time" style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
                Horário
              </label>
              <input
                id="schedule-input-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                data-testid="schedule-input-time"
                required
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#ffffff',
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="schedule-input-notes" style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
                Observações / Notas (opcional)
              </label>
              <span
                data-testid="schedule-notes-counter"
                style={{ fontSize: 11, color: '#94a3b8' }}
              >
                {notes.length}/1000
              </span>
            </div>
            <textarea
              id="schedule-input-notes"
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Levar pipoca, assistir via Discord às 20h..."
              data-testid="schedule-input-notes"
              rows={3}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#ffffff',
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 14,
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              data-testid="schedule-action-cancel"
              onClick={onClose}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: '#334155',
                border: 'none',
                borderRadius: 10,
                color: '#f8fafc',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="schedule-action-confirm"
              disabled={isLoading}
              style={{
                flex: 2,
                padding: '12px 16px',
                backgroundColor: isLoading ? '#1d4ed8' : '#2563eb',
                border: 'none',
                borderRadius: 10,
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: isLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {isLoading ? 'Agendando...' : 'Confirmar Agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
