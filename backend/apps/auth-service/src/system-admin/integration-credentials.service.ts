import { createHash, randomBytes } from 'node:crypto';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { RealtimeGateway } from '../smart-scheduling/realtime.gateway';
import {
  CreateIntegrationProviderDto,
  UpdateIntegrationProviderDto,
} from './dto/integration-credentials.dto';

type StoredCredentialState = {
  apiKeyHash?: string;
  apiKeyPrefix?: string;
  apiKeyFingerprint?: string;
  apiKeyIssuedAt?: string;
  apiKeyLastRotatedAt?: string;
  [key: string]: unknown;
};

/**
 * Manages tenant-scoped integration providers (LIS, FHIR, telephony, etc.)
 * and their API keys. Keys are returned in plaintext only at creation /
 * rotation; storage uses argon2 hashes + a short prefix for identification
 * in audit trails.
 */
@Injectable()
export class IntegrationCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async listProviders(user: AuthenticatedUser) {
    const providers = await this.prisma.integrationProvider.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ providerType: 'asc' }, { providerCode: 'asc' }],
    });
    return providers.map((p) => ({
      id: p.id,
      providerType: p.providerType,
      providerCode: p.providerCode,
      providerName: p.providerName,
      authenticationType: p.authenticationType,
      rateLimitPerMinute: p.rateLimitPerMinute,
      isActive: p.isActive,
      createdAt: p.createdAt,
      apiKeyPrefix: extractCredentialState(p.configurationJson).apiKeyPrefix ?? null,
      configuration: redactCredentials(p.configurationJson),
    }));
  }

  async createProvider(user: AuthenticatedUser, dto: CreateIntegrationProviderDto) {
    const conflict = await this.prisma.integrationProvider.findFirst({
      where: { tenantId: user.tenantId, providerCode: dto.providerCode },
    });
    if (conflict) {
      throw new ConflictException(
        `Integration provider with code "${dto.providerCode}" already exists`,
      );
    }

    const { apiKey, configuration } = await this.generateApiKey(dto.configuration ?? {});

    const provider = await this.prisma.integrationProvider.create({
      data: {
        tenantId: user.tenantId,
        providerType: dto.providerType,
        providerCode: dto.providerCode,
        providerName: dto.providerName,
        authenticationType: dto.authenticationType,
        rateLimitPerMinute: dto.rateLimitPerMinute ?? 60,
        configurationJson: configuration as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.integration.provider.created',
      entityType: 'integration_provider',
      entityId: provider.id,
      newValuesJson: {
        providerType: provider.providerType,
        providerCode: provider.providerCode,
        providerName: provider.providerName,
        authenticationType: provider.authenticationType,
        apiKeyPrefix: (configuration as StoredCredentialState).apiKeyPrefix,
      },
    });

    this.realtime.emitTenantSystemEvent('tenant.integration.created', user.tenantId, {
      tenantId: user.tenantId,
      providerId: provider.id,
      providerCode: provider.providerCode,
    });

    return {
      id: provider.id,
      providerType: provider.providerType,
      providerCode: provider.providerCode,
      providerName: provider.providerName,
      authenticationType: provider.authenticationType,
      apiKey,
      apiKeyPrefix: (configuration as StoredCredentialState).apiKeyPrefix,
      issuedAt: (configuration as StoredCredentialState).apiKeyIssuedAt,
    };
  }

  async updateProvider(
    user: AuthenticatedUser,
    providerId: string,
    dto: UpdateIntegrationProviderDto,
  ) {
    const existing = await this.assertOwnedProvider(user.tenantId, providerId);
    const existingState = extractCredentialState(existing.configurationJson);

    const mergedConfig: StoredCredentialState = {
      ...(existing.configurationJson as Record<string, unknown>),
      ...(dto.configuration ?? {}),
    };
    // Forbid overwriting credential metadata via free-form configuration.
    mergedConfig.apiKeyHash = existingState.apiKeyHash;
    mergedConfig.apiKeyPrefix = existingState.apiKeyPrefix;
    mergedConfig.apiKeyFingerprint = existingState.apiKeyFingerprint;
    mergedConfig.apiKeyIssuedAt = existingState.apiKeyIssuedAt;
    mergedConfig.apiKeyLastRotatedAt = existingState.apiKeyLastRotatedAt;

    const updated = await this.prisma.integrationProvider.update({
      where: { id: providerId },
      data: {
        ...(dto.providerName !== undefined ? { providerName: dto.providerName } : {}),
        ...(dto.rateLimitPerMinute !== undefined
          ? { rateLimitPerMinute: dto.rateLimitPerMinute }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        configurationJson: mergedConfig as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.integration.provider.updated',
      entityType: 'integration_provider',
      entityId: providerId,
      oldValuesJson: {
        providerName: existing.providerName,
        rateLimitPerMinute: existing.rateLimitPerMinute,
        isActive: existing.isActive,
      },
      newValuesJson: {
        providerName: updated.providerName,
        rateLimitPerMinute: updated.rateLimitPerMinute,
        isActive: updated.isActive,
      },
    });

    this.realtime.emitTenantSystemEvent('tenant.integration.updated', user.tenantId, {
      tenantId: user.tenantId,
      providerId,
      providerCode: updated.providerCode,
      isActive: updated.isActive,
    });

    return {
      id: updated.id,
      providerName: updated.providerName,
      rateLimitPerMinute: updated.rateLimitPerMinute,
      isActive: updated.isActive,
      configuration: redactCredentials(updated.configurationJson),
    };
  }

  async rotateApiKey(user: AuthenticatedUser, providerId: string) {
    const existing = await this.assertOwnedProvider(user.tenantId, providerId);
    const previousState = extractCredentialState(existing.configurationJson);

    const { apiKey, configuration } = await this.generateApiKey(
      (existing.configurationJson as Record<string, unknown>) ?? {},
      { rotated: true },
    );

    const updated = await this.prisma.integrationProvider.update({
      where: { id: providerId },
      data: { configurationJson: configuration as Prisma.InputJsonValue },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.integration.provider.key.rotated',
      entityType: 'integration_provider',
      entityId: providerId,
      oldValuesJson: { apiKeyPrefix: previousState.apiKeyPrefix ?? null },
      newValuesJson: {
        apiKeyPrefix: (configuration as StoredCredentialState).apiKeyPrefix,
      },
    });

    this.realtime.emitTenantSystemEvent('tenant.integration.key.rotated', user.tenantId, {
      tenantId: user.tenantId,
      providerId,
      providerCode: existing.providerCode,
      apiKeyPrefix: (configuration as StoredCredentialState).apiKeyPrefix,
    });

    return {
      id: updated.id,
      apiKey,
      apiKeyPrefix: (configuration as StoredCredentialState).apiKeyPrefix,
      rotatedAt: (configuration as StoredCredentialState).apiKeyLastRotatedAt,
    };
  }

  async deleteProvider(user: AuthenticatedUser, providerId: string) {
    const existing = await this.assertOwnedProvider(user.tenantId, providerId);

    await this.prisma.integrationProvider.delete({ where: { id: providerId } });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.integration.provider.deleted',
      entityType: 'integration_provider',
      entityId: providerId,
      oldValuesJson: {
        providerType: existing.providerType,
        providerCode: existing.providerCode,
      },
    });

    this.realtime.emitTenantSystemEvent('tenant.integration.deleted', user.tenantId, {
      tenantId: user.tenantId,
      providerId,
      providerCode: existing.providerCode,
    });

    return { ok: true };
  }

  /**
   * Verifies an API key. Used internally by other modules to validate
   * incoming B2B requests.
   */
  async verifyApiKey(tenantId: string, apiKey: string) {
    if (!apiKey.startsWith('mck_live_')) {
      throw new BadRequestException('Malformed API key');
    }
    const fingerprint = createHash('sha256').update(apiKey).digest('hex').slice(0, 32);

    const candidates = await this.prisma.integrationProvider.findMany({
      where: { tenantId, isActive: true },
    });
    for (const candidate of candidates) {
      const state = extractCredentialState(candidate.configurationJson);
      if (state.apiKeyFingerprint && state.apiKeyFingerprint === fingerprint && state.apiKeyHash) {
        const ok = await argon2.verify(state.apiKeyHash, apiKey);
        if (ok) {
          return {
            providerId: candidate.id,
            providerCode: candidate.providerCode,
            providerType: candidate.providerType,
          };
        }
      }
    }
    return null;
  }

  private async assertOwnedProvider(tenantId: string, providerId: string) {
    const provider = await this.prisma.integrationProvider.findUnique({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException('Integration provider not found');
    }
    if (provider.tenantId !== tenantId) {
      throw new ForbiddenException('Provider belongs to a different tenant');
    }
    return provider;
  }

  private async generateApiKey(
    baseConfig: Record<string, unknown>,
    options: { rotated?: boolean } = {},
  ) {
    const secret = randomBytes(32).toString('base64url');
    const apiKey = `mck_live_${secret}`;
    const apiKeyHash = await argon2.hash(apiKey);
    const apiKeyPrefix = `mck_live_${secret.slice(0, 6)}`;
    const apiKeyFingerprint = createHash('sha256').update(apiKey).digest('hex').slice(0, 32);
    const now = new Date().toISOString();

    const configuration: StoredCredentialState = {
      ...baseConfig,
      apiKeyHash,
      apiKeyPrefix,
      apiKeyFingerprint,
      apiKeyIssuedAt: options.rotated
        ? ((baseConfig.apiKeyIssuedAt as string | undefined) ?? now)
        : now,
      apiKeyLastRotatedAt: options.rotated
        ? now
        : ((baseConfig.apiKeyLastRotatedAt as string | undefined) ?? undefined),
    };

    return { apiKey, configuration };
  }
}

function extractCredentialState(value: unknown): StoredCredentialState {
  if (!value || typeof value !== 'object') return {};
  return value as StoredCredentialState;
}

function redactCredentials(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const copy = { ...(value as Record<string, unknown>) };
  delete copy.apiKeyHash;
  delete copy.apiKeyFingerprint;
  return copy;
}
