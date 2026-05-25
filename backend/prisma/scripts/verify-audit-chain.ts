import { AuditChainService } from '../../core/security/audit-chain.service';

async function main() {
  const service = new AuditChainService();
  console.log('Running sequential cryptographic integrity verification on Audit Trail...');

  const report = await service.verifyChain();

  if (report.success) {
    console.log('\x1b[32m%s\x1b[0m', 'INTEGRITY VERIFIED: ' + report.message);
  } else {
    console.error('\x1b[31m%s\x1b[0m', 'TAMPERING DETECTED: ' + report.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Audit verification crashed:', err);
  process.exit(1);
});
