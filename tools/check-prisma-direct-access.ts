import * as fs from 'node:fs';
import * as path from 'node:path';

const TENANT_OWNED_MODELS = [
  'patient',
  'appointment',
  'encounter',
  'invoice',
  'payment',
  'warehouse',
  'inventoryBalance',
  'communication',
];

const IGNORED_FILES = [
  'prisma.service.ts',
  'scheduling-prisma.service.ts',
  'tenant-scoped-prisma.service.ts',
  'check-prisma-direct-access.ts',
];

// Whitelist of legacy files that are currently allowed to have direct access.
// New files must not be added to this list.
const LEGACY_WHITELIST = [
  'apps/worker/src/notifications/notifications-schedule-scan.worker.ts',
  'apps/auth-service/src/patient-portal/documents/portal-documents.service.ts',
  'apps/auth-service/src/patient-portal/profile/portal-profile.service.ts',
  'apps/auth-service/src/communications/communications.service.ts',
  'apps/auth-service/src/patient-portal/booking/portal-booking.service.ts',
  'apps/auth-service/src/patient-portal/auth/portal-auth.service.ts',
  'apps/auth-service/src/patient-portal/auth/portal-connect.service.ts',
  'apps/auth-service/src/patient-portal/auth/patient-jwt.strategy.ts',
  'apps/auth-service/src/patient-portal/visits/portal-visits.service.ts',
  'apps/auth-service/src/patient-portal/auth/portal-otp.service.ts',
  'apps/auth-service/src/finance/finance.service.ts',
  'apps/auth-service/src/patient-portal/payments/portal-payments.service.ts',
  'apps/auth-service/src/reception/reception.service.ts',
  'apps/auth-service/src/inventory-warehouse/inventory.service.ts',
  'apps/auth-service/src/patient-crm/patient-crm.service.ts',
  'apps/auth-service/src/smart-scheduling/smart-scheduling.service.ts',
  'apps/integrations-service/src/controllers/fhir.controller.ts',
  'apps/scheduling-service/src/smart-scheduling/reminders.service.ts',
  'apps/scheduling-service/src/smart-scheduling/smart-scheduling.rpc.controller.ts',
  'apps/scheduling-service/src/smart-scheduling/smart-scheduling.service.ts',
  'apps/worker/src/kpi/kpi-daily.worker.ts',
  'apps/analytics-service/src/core/digest.processor.ts',
  'apps/analytics-service/src/core/fact-etl.processor.ts',
  'apps/analytics-service/src/core/ml.client.ts',
  'apps/auth-service/src/business-intelligence/bi.service.ts',
  'apps/auth-service/src/emr/emr.service.ts',
  'apps/auth-service/src/emr/fhir/fhir-export.service.ts',
  'prisma/seeds/seed.ts',
  'prisma/seeds/seed-future.ts',
];

const IGNORED_DIRS = ['node_modules', 'dist', '.git', 'repositories'];

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORED_DIRS.includes(file)) {
        scanDirectory(fullPath, fileList);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(file);
      if (
        (ext === '.ts' || ext === '.js') &&
        !file.endsWith('.spec.ts') &&
        !file.endsWith('.spec.js') &&
        !file.endsWith('.e2e-spec.ts')
      ) {
        if (!file.endsWith('.repository.ts') && !IGNORED_FILES.includes(file)) {
          fileList.push(fullPath);
        }
      }
    }
  }
  return fileList;
}

function checkFiles() {
  const backendDir = path.resolve(__dirname, '../backend');
  const files = scanDirectory(backendDir);
  let violationsCount = 0;

  const regexList = TENANT_OWNED_MODELS.map((model) => new RegExp(`\\.prisma\\.${model}\\b`, 'i'));

  for (const file of files) {
    // Get relative path from backend folder to match whitelist
    const relativePath = path.relative(backendDir, file);

    // If it's whitelisted, skip checking
    if (LEGACY_WHITELIST.includes(relativePath)) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const regex of regexList) {
        if (regex.test(line) && !line.includes('// ts-ignore-direct-access')) {
          console.error(
            `Violation: Direct Prisma access to tenant-owned model detected in backend/${relativePath}:${i + 1}\n  > ${line.trim()}`,
          );
          violationsCount++;
        }
      }
    }
  }

  if (violationsCount > 0) {
    console.error(
      `\nFound ${violationsCount} direct Prisma access violations to tenant-owned models.`,
    );
    process.exit(1);
  } else {
    console.log('No direct Prisma access violations found. Success!');
    process.exit(0);
  }
}

checkFiles();
