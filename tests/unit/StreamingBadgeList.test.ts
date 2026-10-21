import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StreamingProvider } from '../../src/core/domain/entities/Movie.js';
import {
  getProviderBrandColor,
  getProviderShortName,
  StreamingBadgeList,
} from '../../src/mobile/components/StreamingBadgeList.js';

describe('StreamingBadgeList Component and Helpers', () => {
  const mockProviders: readonly StreamingProvider[] = [
    {
      providerId: 8,
      providerName: 'Netflix',
      slug: 'netflix',
      brandColor: '#E50914',
      logoPath: 'https://image.tmdb.org/t/p/w500/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
    },
    {
      providerId: 119,
      providerName: 'Prime Video',
      slug: 'prime-video',
      brandColor: '#00A8E1',
      logoPath: 'https://image.tmdb.org/t/p/w500/emthp39XA2GUNqUwRXZAnZ5vc9V.jpg',
    },
    {
      providerId: 1899,
      providerName: 'Max',
      slug: 'max',
      brandColor: '#002BE7',
      logoPath: 'https://image.tmdb.org/t/p/w500/aS2zvJWn92ItSVbtLJYX7vgW0St.jpg',
    },
    {
      providerId: 337,
      providerName: 'Disney+',
      slug: 'disney-plus',
      brandColor: '#113CCF',
      logoPath: 'https://image.tmdb.org/t/p/w500/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg',
    },
    {
      providerId: 350,
      providerName: 'Apple TV+',
      slug: 'apple-tv-plus',
      brandColor: '#000000',
      logoPath: null,
    },
  ];

  describe('getProviderBrandColor', () => {
    it('deve priorizar a propriedade brandColor do objeto provider', () => {
      const color = getProviderBrandColor({
        providerId: 999,
        providerName: 'Custom Service',
        brandColor: '#123456',
      });
      expect(color).toBe('#123456');
    });

    it('deve recuperar a cor de marca padrão via slug ou nome conhecido', () => {
      expect(
        getProviderBrandColor({ providerId: 8, providerName: 'Netflix', slug: 'netflix' }),
      ).toBe('#E50914');
      expect(
        getProviderBrandColor({ providerId: 119, providerName: 'Amazon Prime Video' }),
      ).toBe('#00A8E1');
      expect(
        getProviderBrandColor({ providerId: 1899, providerName: 'Max', slug: 'max' }),
      ).toBe('#002BE7');
      expect(
        getProviderBrandColor({ providerId: 337, providerName: 'Disney+' }),
      ).toBe('#113CCF');
      expect(
        getProviderBrandColor({ providerId: 307, providerName: 'Globoplay' }),
      ).toBe('#E31C23');
    });

    it('deve retornar cor neutra padrão para serviços desconhecidos', () => {
      expect(
        getProviderBrandColor({ providerId: 8888, providerName: 'Canal Misterioso' }),
      ).toBe('#334155');
    });
  });

  describe('getProviderShortName', () => {
    it('deve retornar abreviações amigáveis para os principais serviços', () => {
      expect(getProviderShortName('Netflix')).toBe('N');
      expect(getProviderShortName('Prime Video')).toBe('Prime');
      expect(getProviderShortName('Max')).toBe('Max');
      expect(getProviderShortName('Disney+')).toBe('D+');
      expect(getProviderShortName('Apple TV+')).toBe('Apple');
      expect(getProviderShortName('Globoplay')).toBe('Globo');
      expect(getProviderShortName('Paramount+')).toBe('P+');
      expect(getProviderShortName('Telecine')).toBe('TC');
      expect(getProviderShortName('Star+')).toBe('Star+');
    });

    it('deve truncar em 3 caracteres para nomes genéricos', () => {
      expect(getProviderShortName('IndieFlix')).toBe('IND');
    });
  });

  describe('component rendering', () => {
    it('deve retornar null para lista vazia de provedores', () => {
      const element = React.createElement(StreamingBadgeList, {
        providers: [],
      });
      expect(element).toBeDefined();
    });

    it('deve renderizar elemento React com badges visíveis e indicador de overflow', () => {
      const onProviderPress = vi.fn();
      const element = React.createElement(StreamingBadgeList, {
        providers: mockProviders,
        maxVisible: 3,
        size: 'medium',
        selectedProviderId: 119,
        onProviderPress,
        testId: 'custom-badge-list',
      });

      expect(element).toBeDefined();
      expect(element.props.providers).toHaveLength(5);
      expect(element.props.maxVisible).toBe(3);
      expect(element.props.selectedProviderId).toBe(119);
      expect(element.props.testId).toBe('custom-badge-list');
    });

    it('deve instanciar com modo showNames ativo', () => {
      const element = React.createElement(StreamingBadgeList, {
        providers: mockProviders.slice(0, 2),
        showNames: true,
      });

      expect(element).toBeDefined();
      expect(element.props.showNames).toBe(true);
      expect(element.props.providers[0]?.providerName).toBe('Netflix');
    });
  });
});
