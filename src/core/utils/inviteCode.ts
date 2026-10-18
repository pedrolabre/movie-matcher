import { randomInt } from 'node:crypto';

export const UNAMBIGUOUS_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' as const;
export const DEFAULT_INVITE_CODE_LENGTH = 6;
export const INVITE_CODE_REGEX = /^[2-9A-HJ-NP-Z]+$/;

export function generateInviteCode(length: number = DEFAULT_INVITE_CODE_LENGTH): string {
  if (length < 4 || length > 16) {
    throw new RangeError('Invite code length must be between 4 and 16 characters');
  }

  const charsetLength = UNAMBIGUOUS_CHARSET.length;
  let code = '';

  for (let i = 0; i < length; i++) {
    const index = randomInt(0, charsetLength);
    code += UNAMBIGUOUS_CHARSET[index];
  }

  return code;
}

export function sanitizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidInviteCode(code: string, minLength = 4, maxLength = 16): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  const sanitized = sanitizeInviteCode(code);

  if (sanitized.length < minLength || sanitized.length > maxLength) {
    return false;
  }

  return INVITE_CODE_REGEX.test(sanitized);
}
