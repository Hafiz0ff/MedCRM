import { PrismaService } from '@core/database/prisma.service';
import { normalizeName, normalizePhone, computeBlindIndex } from '@core/security/blind-index';
import { EncryptionService } from '@core/security/encryption.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PatientListQuery } from '../dto/patient.schemas';
import { assertBranchAccess } from '../patient-crm.utils';

/**
 * Service to manage querying and searching patients.
 */
@Injectable()
export class PatientQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Returns a paginated list of patients matching the specified filters.
   */
  async list(user: AuthenticatedUser, query: PatientListQuery) {
    const where = await this.buildWhere(user, query);
    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        include: {
          contacts: { orderBy: { isPrimary: 'desc' } },
          registrationBranch: true,
          tags: { include: { tag: true } },
          metrics: true,
          invoices: { where: { status: { in: ['DRAFT', 'PENDING_PAYMENT'] } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Searches patients and detects potential duplicates.
   */
  async search(user: AuthenticatedUser, query: PatientListQuery) {
    const result = await this.list(user, query);
    return {
      ...result,
      duplicateCandidates: query.q ? await this.findDuplicateCandidates(user, query.q) : [],
    };
  }

  private async buildWhere(
    user: AuthenticatedUser,
    query: PatientListQuery,
  ): Promise<Prisma.PatientWhereInput> {
    if (query.branchId) assertBranchAccess(user, query.branchId);

    const searchConditions: Prisma.PatientWhereInput[] = [];
    if (query.q) {
      const { dek } = await this.encryption.getOrCreateTenantDek(user.tenantId);

      const isDigits = /^\+?[0-9\s\-()]+$/.test(query.q);
      if (isDigits && query.q.replace(/\D/g, '').length >= 3) {
        const phoneBi = computeBlindIndex(normalizePhone(query.q), dek);
        searchConditions.push({
          contacts: {
            some: { valueBi: phoneBi },
          },
        });
      } else {
        const isCode = /^P-\d+$/i.test(query.q.trim()) || /^[a-fA-F0-9-]{36}$/.test(query.q.trim());
        if (isCode) {
          searchConditions.push({
            patientCode: { contains: query.q.trim(), mode: 'insensitive' },
          });
        } else {
          const tokens = query.q.trim().split(/\s+/).map(normalizeName);
          const tokenConditions = tokens.map((token) => {
            const bi = computeBlindIndex(token, dek);
            return {
              OR: [
                { firstNameBi: bi },
                { lastNameBi: bi },
                { middleNameBi: bi },
                { passportNumberBi: bi },
              ],
            };
          });
          searchConditions.push({ AND: tokenConditions });
        }
      }
    }

    return {
      tenantId: user.tenantId,
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
      AND: [
        {
          OR: query.branchId
            ? [{ registrationBranchId: query.branchId }]
            : [{ registrationBranchId: null }, { registrationBranchId: { in: user.branchIds } }],
        },
        ...searchConditions,
      ],
    };
  }

  private async findDuplicateCandidates(user: AuthenticatedUser, q: string) {
    const { dek } = await this.encryption.getOrCreateTenantDek(user.tenantId);

    const isPhone = /^\+?[0-9\s\-()]+$/.test(q);
    if (isPhone) {
      const phoneBi = computeBlindIndex(normalizePhone(q), dek);
      return this.prisma.patient.findMany({
        where: {
          tenantId: user.tenantId,
          contacts: { some: { valueBi: phoneBi } },
        },
        include: { contacts: true },
        take: 5,
      });
    }

    const tokens = q.trim().split(/\s+/).map(normalizeName);
    const tokenConditions = tokens.map((token) => {
      const bi = computeBlindIndex(token, dek);
      return {
        OR: [{ firstNameBi: bi }, { lastNameBi: bi }, { middleNameBi: bi }],
      };
    });

    return this.prisma.patient.findMany({
      where: {
        tenantId: user.tenantId,
        AND: tokenConditions,
      },
      include: { contacts: true },
      take: 5,
    });
  }
}
