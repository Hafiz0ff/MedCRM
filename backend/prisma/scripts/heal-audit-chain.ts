import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

interface AuditLogCanonicalData {
  tenantId: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  userId?: string | null;
  requestId: string;
  createdAt: Date;
}

function computeHash(prevHash: string | null, record: AuditLogCanonicalData): string {
  const parts = [
    prevHash || '',
    record.tenantId,
    record.action,
    record.entityType || '',
    record.entityId || '',
    record.userId || '',
    record.requestId,
    record.createdAt.toISOString(),
  ];
  const canonicalString = parts.join('|');
  return createHash('sha256').update(canonicalString).digest('hex');
}

async function main() {
  const prisma = new PrismaClient();
  console.log('Fetching all audit logs to heal the cryptographic chain...');

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${logs.length} logs. Recalculating hash chain...`);

  await prisma.$queryRawUnsafe(`ALTER TABLE "platform"."audit_logs" DISABLE TRIGGER ALL`);

  let prevHash: string | null = null;
  let updatedCount = 0;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const expectedPrevHash = prevHash;
    const expectedHash = computeHash(expectedPrevHash, {
      tenantId: log.tenantId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.userId,
      requestId: log.requestId,
      createdAt: log.createdAt,
    });

    if (log.prevHash !== expectedPrevHash || log.hash !== expectedHash) {
      await prisma.$executeRawUnsafe(
        `UPDATE "platform"."audit_logs" SET prev_hash = $1, hash = $2 WHERE id = $3::uuid`,
        expectedPrevHash,
        expectedHash,
        log.id,
      );
      updatedCount++;
    }

    prevHash = expectedHash;
  }

  await prisma.$queryRawUnsafe(`ALTER TABLE "platform"."audit_logs" ENABLE TRIGGER ALL`);

  console.log(`Cryptographic hash chain healed successfully! Updated ${updatedCount} logs.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error healing chain:', err);
  process.exit(1);
});
