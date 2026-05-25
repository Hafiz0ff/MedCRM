import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('Cleaning up tampered test logs from audit_logs table...');

  try {
    await prisma.$queryRawUnsafe(`ALTER TABLE audit_logs DISABLE TRIGGER ALL`);
    const deleteCount = await prisma.$executeRawUnsafe(
      `DELETE FROM audit_logs WHERE action IN ('test.verification.event1', 'test.verification.event2', 'test.tampered.event')`,
    );
    await prisma.$queryRawUnsafe(`ALTER TABLE audit_logs ENABLE TRIGGER ALL`);

    console.log(`Successfully deleted ${deleteCount} tampered/test log entries.`);
  } catch (err) {
    console.error('Error cleaning up logs:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Cleanup crashed:', err);
  process.exit(1);
});
