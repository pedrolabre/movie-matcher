import React, { useState } from 'react';
import { StreamingProvider } from '../../core/domain/entities/Movie.js';

export interface StreamingBadgeListProps {
  readonly providers: readonly StreamingProvider[];
  readonly maxVisible?: number | undefined;
  readonly size?: number | 'small' | 'medium' | 'large' | undefined;
  readonly showNames?: boolean | undefined;
  readonly selectedProviderId?: number | null | undefined;
  readonly onProviderPress?: ((provider: StreamingProvider) => void) | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly testId?: string | undefined;
}

const BRAND_COLORS: Record<string, string> = {
  'netflix': '#E50914',
  'prime-video': '#00A8E1',
  'prime video': '#00A8E1',
  'amazon prime video': '#00A8E1',
  'max': '#002BE7',
  'hbo max': '#002BE7',
  'disney+': '#113CCF',
  'disney-plus': '#113CCF',
  'disney plus': '#113CCF',
  'apple tv+': '#000000',
  'apple-tv-plus': '#000000',
  'apple tv': '#000000',
  'globoplay': '#E31C23',
  'paramount+': '#0064FF',
  'telecine': '#ED1C24',
  'star+': '#0B0B0F',
  'claro video': '#DA291C',
  'crunchyroll': '#F47521',
};

export function getProviderBrandColor(provider: StreamingProvider): string {
  if (provider.brandColor) {
    return provider.brandColor;
  }

  const slug = provider.slug?.toLowerCase();
  if (slug && BRAND_COLORS[slug]) {
    return BRAND_COLORS[slug];
  }

  const name = provider.providerName.toLowerCase().trim();
  if (BRAND_COLORS[name]) {
    return BRAND_COLORS[name];
  }

  return '#334155';
}

export function getProviderShortName(providerName: string): string {
  const trimmed = providerName.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes('netflix')) return 'N';
  if (lower.includes('prime')) return 'Prime';
  if (lower.includes('max')) return 'Max';
  if (lower.includes('disney')) return 'D+';
  if (lower.includes('apple')) return 'Apple';
  if (lower.includes('globoplay')) return 'Globo';
  if (lower.includes('paramount')) return 'P+';
  if (lower.includes('telecine')) return 'TC';
  if (lower.includes('star+')) return 'Star+';

  return trimmed.slice(0, 3).toUpperCase();
}

export const StreamingBadgeList: React.FC<StreamingBadgeListProps> = ({
  providers,
  maxVisible = 4,
  size = 'medium',
  showNames = false,
  selectedProviderId = null,
  onProviderPress,
  style,
  testId = 'streaming-badge-list',
}) => {
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  if (!providers || providers.length === 0) {
    return null;
  }

  const pixelSize =
    typeof size === 'number'
      ? size
      : size === 'small'
        ? 20
        : size === 'large'
          ? 36
          : 26;

  const visibleProviders = providers.slice(0, maxVisible);
  const overflowCount = providers.length - maxVisible;
  const remainingProviders = providers.slice(maxVisible);

  const handleImageError = (providerId: number) => {
    setImageErrors((prev) => ({ ...prev, [providerId]: true }));
  };

  return (
    <div
      data-testid={testId}
      aria-label="Plataformas de streaming disponíveis"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        ...style,
      }}
    >
      {visibleProviders.map((provider) => {
        const isSelected = selectedProviderId === provider.providerId;
        const brandColor = getProviderBrandColor(provider);
        const hasImageError = Boolean(imageErrors[provider.providerId]);
        const hasValidLogo = Boolean(provider.logoPath && !hasImageError);
        const shortName = getProviderShortName(provider.providerName);

        const isInteractive = Boolean(onProviderPress);

        return (
          <div
            key={provider.providerId}
            data-testid={`streaming-badge-${provider.providerId}`}
            data-provider-id={provider.providerId}
            data-provider-name={provider.providerName}
            data-selected={isSelected}
            title={provider.providerName}
            aria-label={provider.providerName}
            onClick={() => onProviderPress?.(provider)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: showNames ? 6 : 0,
              padding: showNames ? '3px 8px 3px 4px' : '2px',
              borderRadius: 8,
              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.25)' : '#0f172a',
              border: isSelected ? '2px solid #3b82f6' : '1px solid #334155',
              cursor: isInteractive ? 'pointer' : 'default',
              boxShadow: isSelected
                ? '0 0 0 1px #3b82f6, 0 2px 4px rgba(0, 0, 0, 0.25)'
                : '0 1px 2px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.15s ease',
            }}
          >
            {hasValidLogo ? (
              <img
                src={provider.logoPath!}
                alt={provider.providerName}
                onError={() => handleImageError(provider.providerId)}
                style={{
                  width: pixelSize,
                  height: pixelSize,
                  borderRadius: 6,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div
                data-testid={`streaming-fallback-${provider.providerId}`}
                style={{
                  width: pixelSize,
                  height: pixelSize,
                  borderRadius: 6,
                  backgroundColor: brandColor,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: Math.max(9, Math.floor(pixelSize * 0.42)),
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  userSelect: 'none',
                }}
              >
                {shortName}
              </div>
            )}

            {showNames && (
              <span
                style={{
                  fontSize: Math.max(11, Math.floor(pixelSize * 0.45)),
                  fontWeight: 600,
                  color: isSelected ? '#ffffff' : '#e2e8f0',
                  whiteSpace: 'nowrap',
                }}
              >
                {provider.providerName}
              </span>
            )}
          </div>
        );
      })}

      {overflowCount > 0 && (
        <div
          data-testid="streaming-badge-overflow"
          title={`Outros: ${remainingProviders.map((p) => p.providerName).join(', ')}`}
          aria-label={`Mais ${overflowCount} serviços de streaming`}
          style={{
            height: pixelSize,
            minWidth: pixelSize,
            padding: '0 6px',
            borderRadius: 6,
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            color: '#94a3b8',
            fontSize: Math.max(10, Math.floor(pixelSize * 0.42)),
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
};
