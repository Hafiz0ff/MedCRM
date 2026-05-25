import { PrismaClient } from '@prisma/client';
import { normalizeName, normalizePhone, computeBlindIndex } from '../../core/security/blind-index';
import { EncryptionService } from '../../core/security/encryption.service';

async function main() {
  const prisma = new PrismaClient();
  const encryption = new EncryptionService();

  console.log('Starting PHI migration and backfill...');

  // 1. Migrate Patients
  const patients = await prisma.patient.findMany({
    where: {
      firstNameEnc: null,
    },
  });

  console.log(`Found ${patients.length} patients requiring PHI encryption...`);

  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];
    const { dek } = await encryption.getOrCreateTenantDek(p.tenantId);

    const firstNameEnc = p.firstName ? await encryption.encrypt(p.firstName, p.tenantId) : null;
    const firstNameBi = p.firstName ? computeBlindIndex(normalizeName(p.firstName), dek) : null;

    const lastNameEnc = p.lastName ? await encryption.encrypt(p.lastName, p.tenantId) : null;
    const lastNameBi = p.lastName ? computeBlindIndex(normalizeName(p.lastName), dek) : null;

    const middleNameEnc = p.middleName ? await encryption.encrypt(p.middleName, p.tenantId) : null;
    const middleNameBi = p.middleName ? computeBlindIndex(normalizeName(p.middleName), dek) : null;

    await prisma.patient.update({
      where: { id: p.id },
      data: {
        firstNameEnc,
        firstNameBi,
        lastNameEnc,
        lastNameBi,
        middleNameEnc,
        middleNameBi,
        firstName: '[ENCRYPTED]',
        lastName: '[ENCRYPTED]',
        middleName: '[ENCRYPTED]',
        fullName: '[ENCRYPTED]',
      },
    });

    if ((i + 1) % 50 === 0 || i === patients.length - 1) {
      console.log(`Migrated ${i + 1}/${patients.length} patients...`);
    }
  }

  // 2. Migrate Patient Contacts
  const contacts = await prisma.patientContact.findMany({
    where: {
      type: 'PHONE',
      valueEnc: null,
    },
  });

  console.log(`Found ${contacts.length} patient contacts requiring PHI encryption...`);

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const { dek } = await encryption.getOrCreateTenantDek(c.tenantId);

    const valueEnc = c.value ? await encryption.encrypt(c.value, c.tenantId) : null;
    const valueBi = c.value ? computeBlindIndex(normalizePhone(c.value), dek) : null;

    await prisma.patientContact.update({
      where: { id: c.id },
      data: {
        valueEnc,
        valueBi,
        value: '[ENCRYPTED]',
      },
    });

    if ((i + 1) % 50 === 0 || i === contacts.length - 1) {
      console.log(`Migrated ${i + 1}/${contacts.length} contacts...`);
    }
  }

  console.log('PHI migration and backfill completed successfully!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
