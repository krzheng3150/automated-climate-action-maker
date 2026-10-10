import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(__filename);
const distPath = path.join(projectRoot, 'dist');

console.log('[Packager] Preparing official Chrome Web Store production package...');

// 1. Run full audits & build
execSync('npm test', { stdio: 'inherit', cwd: projectRoot });

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
