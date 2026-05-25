import { createHmac } from 'node:crypto';

/**
 * Normalizes patient names (first name, last name, middle name) by trimming and lowercasing.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Normalizes phone numbers by stripping all non-digit characters (e.g. +7 (999) 123 -> 7999123).
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Normalizes passport numbers by stripping non-alphanumeric characters.
 */
export function normalizePassport(passport: string): string {
  return passport
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '');
}

/**
 * Computes a secure HMAC-SHA256 blind index for exact matching.
 * The tenant's DEK serves as the HMAC key to ensure complete cross-tenant cryptographic isolation.
 */
export function computeBlindIndex(normalizedValue: string, tenantDek: Buffer): string {
  if (!normalizedValue) return '';
  return createHmac('sha256', tenantDek).update(normalizedValue).digest('hex');
}
