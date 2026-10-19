import React from 'react';

export interface VoterProfile {
  readonly id: string;
  readonly displayName?: string | undefined;
  readonly avatarUrl?: string | null | undefined;
}

export interface VoterAvatarStackProps {
  readonly voters: readonly VoterProfile[];
  readonly maxVisible?: number | undefined;
  readonly size?: number | undefined;
  readonly showCount?: boolean | undefined;
  readonly totalMemberCount?: number | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly testId?: string | undefined;
}

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#06b6d4', // cyan
];

export function getAvatarBgColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index]!;
}

export function getInitials(name?: string): string {
  if (!name || name.trim().length === 0) {
    return '?';
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  const first = parts[0]![0] ?? '';
  const second = parts[1]![0] ?? '';
  return `${first}${second}`.toUpperCase();
}

export const VoterAvatarStack: React.FC<VoterAvatarStackProps> = ({
  voters,
  maxVisible = 4,
  size = 32,
  showCount = true,
  totalMemberCount,
  style,
  testId = 'voter-avatar-stack',
}) => {
  if (!voters || voters.length === 0) {
    return null;
  }

  const visibleVoters = voters.slice(0, maxVisible);
  const overflowCount = voters.length - visibleVoters.length;
  const fontSize = Math.max(10, Math.floor(size * 0.38));
  const overlapMargin = -Math.floor(size * 0.28);

  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        ...style,
      }}
    >
      <div
        data-testid="voter-avatar-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'row',
        }}
      >
        {visibleVoters.map((voter, index) => {
          const hasAvatar =
            typeof voter.avatarUrl === 'string' && voter.avatarUrl.trim().length > 0;
          const initials = getInitials(voter.displayName);
          const bgColor = getAvatarBgColor(voter.id);

          return (
            <div
              key={voter.id}
              data-testid={`voter-avatar-${voter.id}`}
              data-voter-id={voter.id}
              title={voter.displayName ?? voter.id}
              style={{
                width: size,
                height: size,
                borderRadius: 9999,
                marginLeft: index === 0 ? 0 : overlapMargin,
                border: '2px solid #1e293b',
                backgroundColor: bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                zIndex: visibleVoters.length - index,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
              }}
            >
              {hasAvatar ? (
                <img
                  src={voter.avatarUrl!}
                  alt={voter.displayName ?? 'Votante'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <span
                  data-testid={`voter-initials-${voter.id}`}
                  style={{
                    color: '#ffffff',
                    fontSize,
                    fontWeight: 700,
                    userSelect: 'none',
                    lineHeight: 1,
                  }}
                >
                  {initials}
                </span>
              )}
            </div>
          );
        })}

        {overflowCount > 0 && (
          <div
            data-testid="voter-avatar-overflow"
            style={{
              width: size,
              height: size,
              borderRadius: 9999,
              marginLeft: overlapMargin,
              border: '2px solid #1e293b',
              backgroundColor: '#334155',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(9, Math.floor(size * 0.34)),
              fontWeight: 700,
              position: 'relative',
              zIndex: 0,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
            }}
          >
            +{overflowCount}
          </div>
        )}
      </div>

      {showCount && (
        <span
          data-testid="voter-count-text"
          style={{
            fontSize: 12,
            color: '#94a3b8',
            fontWeight: 500,
          }}
        >
          {totalMemberCount
            ? `${voters.length} de ${totalMemberCount} votaram`
            : `${voters.length} ${voters.length === 1 ? 'voto' : 'votos'}`}
        </span>
      )}
    </div>
  );
};
