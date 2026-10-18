import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVITE_CODE_LENGTH,
  generateInviteCode,
  isValidInviteCode,
  sanitizeInviteCode,
  UNAMBIGUOUS_CHARSET,
} from '../../src/core/utils/inviteCode.js';

describe('inviteCode utilities', () => {
  it('deve gerar código de convite com tamanho default de 6 caracteres', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(DEFAULT_INVITE_CODE_LENGTH);
    expect(typeof code).toBe('string');
  });

  it('deve gerar código contendo apenas caracteres do conjunto não ambíguo', () => {
    const ambiguousChars = ['0', 'O', '1', 'I'];
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      for (const char of code) {
        expect(UNAMBIGUOUS_CHARSET.includes(char as never)).toBe(true);
        expect(ambiguousChars.includes(char)).toBe(false);
      }
    }
  });

  it('deve permitir gerar códigos com comprimentos customizados válidos', () => {
    expect(generateInviteCode(4)).toHaveLength(4);
    expect(generateInviteCode(8)).toHaveLength(8);
    expect(generateInviteCode(16)).toHaveLength(16);
  });

  it('deve lançar RangeError para comprimentos menores que 4 ou maiores que 16', () => {
    expect(() => generateInviteCode(3)).toThrow(RangeError);
    expect(() => generateInviteCode(17)).toThrow(RangeError);
  });

  it('deve sanitizar código removendo espaços e convertendo para caixa alta', () => {
    expect(sanitizeInviteCode('  cine88  ')).toBe('CINE88');
    expect(sanitizeInviteCode('ab23cd')).toBe('AB23CD');
  });

  it('deve validar formatos de código corretamente', () => {
    expect(isValidInviteCode('CANE88')).toBe(true);
    expect(isValidInviteCode('AB23CD')).toBe(true);
    expect(isValidInviteCode('cane88')).toBe(true); // Sanitiza para caixa alta

    // Caracteres ambíguos ou inválidos
    expect(isValidInviteCode('CIN088')).toBe(false); // Contém '0'
    expect(isValidInviteCode('CINO88')).toBe(false); // Contém 'O'
    expect(isValidInviteCode('CIN188')).toBe(false); // Contém '1'
    expect(isValidInviteCode('CINI88')).toBe(false); // Contém 'I'
    expect(isValidInviteCode('CIN-88')).toBe(false); // Contém caractere especial
    expect(isValidInviteCode('CI')).toBe(false); // Muito curto
    expect(isValidInviteCode('12345678901234567')).toBe(false); // Muito longo
    expect(isValidInviteCode('')).toBe(false);
  });
});
