import {
  normalizeName,
  normalizePhone,
  normalizePassport,
  computeBlindIndex,
} from '@core/security/blind-index';
import { EncryptionService } from '@core/security/encryption.service';
import { TenantContextService } from '@core/tenancy/tenant-context.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

async function encryptPatientData(
  data: any,
  tenantId: string,
  encryptionService: EncryptionService,
) {
  if (!data) return;
  const { dek } = await encryptionService.getOrCreateTenantDek(tenantId);

  if (data.firstName !== undefined) {
    if (data.firstName) {
      data.firstNameEnc = await encryptionService.encrypt(data.firstName, tenantId);
      data.firstNameBi = computeBlindIndex(normalizeName(data.firstName), dek);
    } else {
      data.firstNameEnc = null;
      data.firstNameBi = null;
    }
    data.firstName = '[ENCRYPTED]';
  }

  if (data.lastName !== undefined) {
    if (data.lastName) {
      data.lastNameEnc = await encryptionService.encrypt(data.lastName, tenantId);
      data.lastNameBi = computeBlindIndex(normalizeName(data.lastName), dek);
    } else {
      data.lastNameEnc = null;
      data.lastNameBi = null;
    }
    data.lastName = '[ENCRYPTED]';
  }

  if (data.middleName !== undefined) {
    if (data.middleName) {
      data.middleNameEnc = await encryptionService.encrypt(data.middleName, tenantId);
      data.middleNameBi = computeBlindIndex(normalizeName(data.middleName), dek);
    } else {
      data.middleNameEnc = null;
      data.middleNameBi = null;
    }
    data.middleName = '[ENCRYPTED]';
  }

  if (data.passportNumber !== undefined) {
    if (data.passportNumber) {
      data.passportNumberEnc = await encryptionService.encrypt(data.passportNumber, tenantId);
      data.passportNumberBi = computeBlindIndex(normalizePassport(data.passportNumber), dek);
    } else {
      data.passportNumberEnc = null;
      data.passportNumberBi = null;
    }
  }

  if (
    data.firstName !== undefined ||
    data.lastName !== undefined ||
    data.middleName !== undefined
  ) {
    data.fullName = '[ENCRYPTED]';
  }

  // Nested contacts
  if (data.contacts?.create) {
    const creates = Array.isArray(data.contacts.create)
      ? data.contacts.create
      : [data.contacts.create];
    for (const c of creates) {
      await encryptContactData(c, tenantId, encryptionService);
    }
  }
  if (data.contacts?.update) {
    const updates = Array.isArray(data.contacts.update)
      ? data.contacts.update
      : [data.contacts.update];
    for (const u of updates) {
      if (u.data) {
        await encryptContactData(u.data, tenantId, encryptionService);
      } else {
        await encryptContactData(u, tenantId, encryptionService);
      }
    }
  }
}

async function encryptContactData(
  data: any,
  tenantId: string,
  encryptionService: EncryptionService,
) {
  if (!data) return;
  if (data.type === 'PHONE' && data.value !== undefined) {
    if (data.value) {
      const { dek } = await encryptionService.getOrCreateTenantDek(tenantId);
      data.valueEnc = await encryptionService.encrypt(data.value, tenantId);
      data.valueBi = computeBlindIndex(normalizePhone(data.value), dek);
    } else {
      data.valueEnc = null;
      data.valueBi = null;
    }
    data.value = '[ENCRYPTED]';
  }
}

async function decryptDeep(
  val: any,
  tenantId: string,
  encryptionService: EncryptionService,
  visited = new Set<any>(),
): Promise<any> {
  if (!val || typeof val !== 'object') return val;
  if (visited.has(val)) return val;
  visited.add(val);

  if (Array.isArray(val)) {
    await Promise.all(val.map((item) => decryptDeep(item, tenantId, encryptionService, visited)));
    return val;
  }

  // Decrypt if it's a Patient record
  if (val.firstNameEnc !== undefined || val.lastNameEnc !== undefined) {
    if (val.firstNameEnc)
      val.firstName = await encryptionService.decrypt(val.firstNameEnc, tenantId);
    if (val.lastNameEnc) val.lastName = await encryptionService.decrypt(val.lastNameEnc, tenantId);
    if (val.middleNameEnc)
      val.middleName = await encryptionService.decrypt(val.middleNameEnc, tenantId);
    if (val.passportNumberEnc)
      val.passportNumber = await encryptionService.decrypt(val.passportNumberEnc, tenantId);

    if (val.firstNameEnc || val.lastNameEnc) {
      const parts = [val.lastName, val.firstName, val.middleName].filter(Boolean);
      val.fullName = parts.join(' ');
    }
  }

  // Decrypt if it's a PatientContact record
  if (val.type === 'PHONE' && val.valueEnc !== undefined) {
    if (val.valueEnc) {
      val.value = await encryptionService.decrypt(val.valueEnc, tenantId);
    }
  }

  // Decrypt nested properties
  const keys = Object.keys(val);
  await Promise.all(keys.map((key) => decryptDeep(val[key], tenantId, encryptionService, visited)));

  return val;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly encryptionService: EncryptionService,
  ) {
    super();

    // Prisma extension callbacks need access to the base client for nested transactions.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const client = this;
    const extended = client.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const context = tenantContext.get();
            const tenantId =
              context.tenantId || (args as any)?.data?.tenantId || (args as any)?.create?.tenantId;

            if (tenantId) {
              // Intercept writes to Patient or PatientContact and encrypt PHI fields
              if (model === 'Patient') {
                if (operation === 'create' || operation === 'update') {
                  await encryptPatientData((args as any).data, tenantId, encryptionService);
                } else if (operation === 'createMany' || operation === 'updateMany') {
                  const dataArr = Array.isArray((args as any).data)
                    ? (args as any).data
                    : [(args as any).data];
                  for (const d of dataArr) {
                    await encryptPatientData(d, tenantId, encryptionService);
                  }
                } else if (operation === 'upsert') {
                  await encryptPatientData((args as any).create, tenantId, encryptionService);
                  await encryptPatientData((args as any).update, tenantId, encryptionService);
                }
              } else if (model === 'PatientContact') {
                if (operation === 'create' || operation === 'update') {
                  await encryptContactData((args as any).data, tenantId, encryptionService);
                } else if (operation === 'createMany' || operation === 'updateMany') {
                  const dataArr = Array.isArray((args as any).data)
                    ? (args as any).data
                    : [(args as any).data];
                  for (const d of dataArr) {
                    await encryptContactData(d, tenantId, encryptionService);
                  }
                } else if (operation === 'upsert') {
                  await encryptContactData((args as any).create, tenantId, encryptionService);
                  await encryptContactData((args as any).update, tenantId, encryptionService);
                }
              }
            }

            let result: any;
            // Only apply RLS if tenantId is present in context
            if (context.tenantId) {
              result = await client.$transaction(async (tx) => {
                await tx.$executeRawUnsafe(
                  `SELECT set_config('app.current_tenant_id', $1, true)`,
                  context.tenantId,
                );
                if (context.userId) {
                  await tx.$executeRawUnsafe(
                    `SELECT set_config('app.current_user_id', $1, true)`,
                    context.userId,
                  );
                }
                const modelNameCamel = model.charAt(0).toLowerCase() + model.slice(1);
                return (tx as any)[modelNameCamel][operation](args);
              });
            } else {
              result = await query(args);
            }

            // Post-query decryption
            if (tenantId && result) {
              await decryptDeep(result, tenantId, encryptionService);
            }

            return result;
          },
        },
      },
    });

    // Attach lifecycle hooks to the extended client
    (extended as any).onModuleInit = async () => {
      await client.$connect();
    };
    (extended as any).onModuleDestroy = async () => {
      await client.$disconnect();
    };

    return extended as any;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async runWithTenant<T>(tenantId: string, callback: () => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'select set_config($1, $2, true)',
        'app.current_tenant_id',
        tenantId,
      );
      return callback();
    });
  }
}
