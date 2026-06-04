import { createHash } from 'node:crypto';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { ForbiddenException } from '@nestjs/common';

/**
 * Validates if the user has access to the specified branch.
 */
export function assertBranchAccess(user: AuthenticatedUser, branchId: string): void {
  if (!user.branchIds.includes(branchId)) {
    throw new ForbiddenException('Branch access denied');
  }
}

/**
 * Constructs the full name of a patient from their name tokens.
 */
export function fullName(input: {
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
}): string {
  return [input.lastName, input.firstName, input.middleName].filter(Boolean).join(' ');
}

/**
 * Normalizes contact value strings.
 */
export function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s()+-]/g, '');
}

/**
 * Generates a SHA-256 hash of a normalized value.
 */
export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
