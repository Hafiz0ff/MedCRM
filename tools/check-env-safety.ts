import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Validates that the production docker-compose.yml does not load .env.example.
 */
function checkEnvSafety() {
  const filePath = path.resolve(__dirname, '../docker-compose.yml');
  if (!fs.existsSync(filePath)) {
    console.error(`docker-compose.yml not found at: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('.env.example')) {
    console.error('VIOLATION: Production docker-compose.yml contains reference to .env.example!');
    process.exit(1);
  }

  console.log('No .env.example references found in production docker-compose.yml. Success!');
  process.exit(0);
}

checkEnvSafety();
