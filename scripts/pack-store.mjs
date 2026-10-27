import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');
const distPath = path.join(projectRoot, 'dist');

console.log('[Packager] Preparing official Chrome Web Store production package...');

// 1. Run full audits & build
execSync('npm test', { stdio: 'inherit', cwd: projectRoot });

// The data credit must ship inside the package
const shippedNotice = path.join(distPath, 'NOTICE');
if (!existsSync(shippedNotice) || !/ADEME/.test(readFileSync(shippedNotice, 'utf8'))) {
  console.error('[FAIL] dist/NOTICE is missing or does not credit ADEME. Refusing to package.');
  process.exit(1);
}

// 2. Read metadata
const manifest = JSON.parse(readFileSync(path.join(distPath, 'manifest.json'), 'utf8'));
const version = manifest.version || '0.1.0';
const zipName = `acam-v${version}.zip`;
const zipPath = path.join(projectRoot, zipName);

// 3. Create zip package from dist folder
try {
  execSync(`cd "${distPath}" && zip -r -q "${zipPath}" . -x "*.map"`, { stdio: 'inherit' });
  console.log(`\n[SUCCESS] Production package created: ${zipName}`);
  console.log(`          Location: ${zipPath}`);
  console.log('          Ready for Chrome Web Store Developer Dashboard upload!');
} catch (err) {
  console.error('[FAIL] Could not create zip archive:', err.message);
  process.exit(1);
}
