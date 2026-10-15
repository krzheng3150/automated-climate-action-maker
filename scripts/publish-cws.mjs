import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');

const isDryRun = process.argv.includes('--dry-run');
const autoPublish = process.argv.includes('--auto-publish');

console.log('[CWS Publisher] Automated Chrome Web Store Upload & Release Pipeline');
if (isDryRun) {
  console.log('[CWS Publisher] Mode: --dry-run (Validation & Package Pre-flight Only)');
}

// 1. Resolve package version and target ZIP
const manifestPath = path.join(projectRoot, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('[FAIL] Root manifest.json not found.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';
const expectedZipName = `acam-v${version}.zip`;
const zipPath = path.join(projectRoot, expectedZipName);

// 2. Ensure package is built and tested
if (!existsSync(zipPath)) {
  console.log(`[CWS Publisher] Package ${expectedZipName} not found. Packaging now via 'npm run pack:store'...`);
  execSync('npm run pack:store', { stdio: 'inherit', cwd: projectRoot });
}

// 3. Inspect ZIP archive
try {
  const stats = statSync(zipPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`[PASS] ZIP archive verified: ${expectedZipName} (${stats.size} bytes / ${sizeMb} MB)`);

  if (stats.size > 100 * 1024 * 1024) {
    console.error('[FAIL] Package exceeds Chrome Web Store 100 MB limit!');
    process.exit(1);
  }

  // Inspect contents via unzip -l
  const listing = execSync(`unzip -l "${zipPath}"`, { encoding: 'utf8' });
  const requiredFiles = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js', 'icons/icon-128.png'];
  for (const req of requiredFiles) {
    if (!listing.includes(req)) {
      console.error(`[FAIL] Package missing required file: ${req}`);
      process.exit(1);
    }
  }
  console.log('[PASS] All core runtime assets present in ZIP archive.');
} catch (err) {
  console.error('[FAIL] Could not verify package:', err.message);
  process.exit(1);
}

// 4. Resolve credentials from environment
const extensionId = process.env.CWS_EXTENSION_ID || process.env.EXTENSION_ID;
const clientId = process.env.CWS_CLIENT_ID || process.env.CLIENT_ID;
const clientSecret = process.env.CWS_CLIENT_SECRET || process.env.CLIENT_SECRET;
const refreshToken = process.env.CWS_REFRESH_TOKEN || process.env.REFRESH_TOKEN;

const credentialsConfigured = Boolean(extensionId && clientId && clientSecret && refreshToken);

if (!credentialsConfigured) {
  console.log('\n[CWS Publisher] Credentials check:');
  console.log(`  - CWS_EXTENSION_ID:   ${extensionId ? '✓ Configured' : '✗ Missing'}`);
  console.log(`  - CWS_CLIENT_ID:      ${clientId ? '✓ Configured' : '✗ Missing'}`);
  console.log(`  - CWS_CLIENT_SECRET:  ${clientSecret ? '✓ Configured' : '✗ Missing'}`);
  console.log(`  - CWS_REFRESH_TOKEN:  ${refreshToken ? '✓ Configured' : '✗ Missing'}`);

  if (isDryRun) {
    console.log('\n[PASS] Dry-run pre-flight validation succeeded.');
    console.log('       Package is verified and ready for automated deployment once credentials are supplied in CI.');
    process.exit(0);
  } else {
    console.error('\n[FAIL] Chrome Web Store credentials missing. Cannot execute upload.');
    console.error('       Set CWS_EXTENSION_ID, CWS_CLIENT_ID, CWS_CLIENT_SECRET, and CWS_REFRESH_TOKEN or run with --dry-run.');
    process.exit(1);
  }
}

// 5. Live Upload Execution (when credentials provided)
async function executeLivePublish() {
  console.log('\n[CWS Publisher] Step 1: Refreshing Google OAuth2 access token...');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error('[FAIL] Could not refresh OAuth token:', tokenData);
    process.exit(1);
  }
  const accessToken = tokenData.access_token;
  console.log('[PASS] OAuth2 access token acquired.');

  console.log(`\n[CWS Publisher] Step 2: Uploading ${expectedZipName} to Item ID ${extensionId}...`);
  const zipBuffer = readFileSync(zipPath);
  const uploadRes = await fetch(`https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extensionId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-goog-api-version': '2',
    },
    body: zipBuffer,
  });

  const uploadResult = await uploadRes.json();
  if (!uploadRes.ok || uploadResult.uploadState !== 'SUCCESS') {
    console.error('[FAIL] Chrome Web Store upload failed:', uploadResult);
    process.exit(1);
  }
  console.log('[PASS] Package uploaded successfully to Chrome Web Store!');

  if (autoPublish) {
    console.log('\n[CWS Publisher] Step 3: Triggering automated publish...');
    const publishRes = await fetch(`https://www.googleapis.com/chromewebstore/v1.1/items/${extensionId}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
      },
      body: JSON.stringify({ target: 'default' }),
    });

    const publishResult = await publishRes.json();
    if (!publishRes.ok || (publishResult.status && publishResult.status.includes('FAIL'))) {
      console.error('[FAIL] Publish request failed:', publishResult);
      process.exit(1);
    }
    console.log('[SUCCESS] Extension successfully submitted for review and publication!');
  } else {
    console.log('\n[SUCCESS] Package uploaded as draft. Ready for review submission in Developer Dashboard.');
  }
}

executeLivePublish().catch((err) => {
  console.error('[FATAL] Unexpected error during CWS publish:', err);
  process.exit(1);
});
