import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');

console.log('[Guardrails: Static] Running static code & manifest audit...');

let failures = 0;

function reportFailure(rule, file, details) {
  console.error(`[FAIL] ${rule}`);
  console.error(`       File: ${file}`);
  console.error(`       Details: ${details}\n`);
  failures++;
}

function reportPass(rule) {
  console.log(`[PASS] ${rule}`);
}

// -------------------------------------------------------------
// 1. Audit manifest.json
// -------------------------------------------------------------
const manifestPath = path.join(projectRoot, 'manifest.json');
try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (manifest.manifest_version !== 3) {
    reportFailure('Manifest Version', 'manifest.json', `Must be Manifest V3, found: ${manifest.manifest_version}`);
  } else {
    reportPass('Manifest V3 Compliance');
  }

  // Store Compliance: Permission Minimization & Scope Check
  const allowedPermissions = ['storage', 'activeTab', 'history', 'alarms'];
  const permissions = manifest.permissions || [];
  const excessPermissions = permissions.filter((p) => !allowedPermissions.includes(p));
  if (excessPermissions.length > 0) {
    reportFailure(
      'Permissions Minimization',
      'manifest.json',
      `Unexpected or excessive permissions detected: ${JSON.stringify(excessPermissions)}. Must strictly be ${JSON.stringify(allowedPermissions)}.`
    );
  } else {
    reportPass('Permissions Minimization: Limited to core single-purpose set (storage, activeTab, history, alarms)');
  }

  // Zero Outbound Host Permissions / Network Egress check
  if (manifest.host_permissions) {
    const wildcards = ['<all_urls>', '*://*/*', 'https://*/*', 'http://*/*'];
    const hasWildcard = manifest.host_permissions.some((p) => wildcards.includes(p));
    if (hasWildcard) {
      reportFailure(
        'Zero Network Egress (Host Permissions)',
        'manifest.json',
        `Unrestricted host_permissions detected: ${JSON.stringify(manifest.host_permissions)}`
      );
    } else {
      reportPass('Restricted Host Permissions (No Wildcards)');
    }
  } else {
    reportPass('Zero Outbound Host Permissions Declared');
  }

  // CSP lockdown check
  const csp = manifest.content_security_policy?.extension_pages;
  if (!csp || !csp.includes("script-src 'self'")) {
    reportFailure('Content Security Policy', 'manifest.json', "Must explicitly restrict script-src to 'self'");
  } else {
    reportPass("Strict CSP: extension_pages locked to 'self'");
  }

  // Icons completeness check
  const icons = manifest.icons || {};
  const requiredSizes = ['16', '32', '48', '128'];
  let missingIcons = 0;
  for (const s of requiredSizes) {
    const iconRel = icons[s];
    if (!iconRel) {
      reportFailure('Store Asset Completeness', 'manifest.json', `Missing icon size ${s} in manifest.icons`);
      missingIcons++;
    } else {
      const sourceAssetPath = path.join(projectRoot, 'assets', iconRel);
      const rootPath = path.join(projectRoot, iconRel);
      const distPath = path.join(projectRoot, 'dist', iconRel);
      if (!existsSync(sourceAssetPath) && !existsSync(rootPath) && !existsSync(distPath)) {
        reportFailure('Store Asset Completeness', iconRel, `Icon file does not exist on disk: ${sourceAssetPath}`);
        missingIcons++;
      }
    }
  }
  if (missingIcons === 0) {
    reportPass('Store Asset Completeness: All 4 standard icons (16, 32, 48, 128) verified');
  }
} catch (err) {
  reportFailure('Manifest Parse', 'manifest.json', err.message);
}

// -------------------------------------------------------------
// 2. Scan TypeScript Source Files
// -------------------------------------------------------------
const srcDir = path.join(projectRoot, 'src');
const tsFiles = existsSync(srcDir)
  ? readdirSync(srcDir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join(srcDir, f))
  : readdirSync(projectRoot)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join(projectRoot, f));

const forbiddenNetworkPatterns = [
  { pattern: /\bfetch\s*\(/g, name: 'fetch()' },
  { pattern: /\bXMLHttpRequest\b/g, name: 'XMLHttpRequest' },
  { pattern: /\bWebSocket\s*\(/g, name: 'WebSocket' },
  { pattern: /\bnavigator\.sendBeacon\s*\(/g, name: 'navigator.sendBeacon' },
  { pattern: /\bEventSource\s*\(/g, name: 'EventSource' },
];

const forbiddenEvalPatterns = [
  { pattern: /\beval\s*\(/g, name: 'eval()' },
  { pattern: /\bnew\s+Function\s*\(/g, name: 'new Function()' },
];

let networkViolations = 0;
let evalViolations = 0;
let timerViolations = 0;
let domSafetyViolations = 0;

for (const filePath of tsFiles) {
  const content = readFileSync(filePath, 'utf8');
  const relPath = path.relative(projectRoot, filePath);

  // Check forbidden network primitives
  for (const item of forbiddenNetworkPatterns) {
    const matches = content.match(item.pattern);
    if (matches) {
      reportFailure('Zero Outbound Telemetry', relPath, `Detected forbidden network call: ${item.name}`);
      networkViolations++;
    }
  }

  // Check eval / dynamic code execution
  for (const item of forbiddenEvalPatterns) {
    const matches = content.match(item.pattern);
    if (matches) {
      reportFailure('Anti-Eval Security', relPath, `Detected forbidden dynamic execution: ${item.name}`);
      evalViolations++;
    }
  }

  // Check unsafe innerHTML assignments (Anti-XSS)
  if (/\.innerHTML\s*=/.test(content)) {
    reportFailure(
      'Anti-XSS DOM Safety',
      relPath,
      'Direct assignment to .innerHTML is forbidden. Use document.createElement, textContent, or replaceChildren instead.'
    );
    domSafetyViolations++;
  }

  // Check timers in background service worker
  if (relPath.includes('background.ts')) {
    if (/\bsetInterval\s*\(/.test(content)) {
      reportFailure(
        'Ephemeral Service Worker Lifecycle',
        relPath,
        'setInterval() is forbidden in service workers. Use chrome.alarms instead.'
      );
      timerViolations++;
    }
  }
}

if (networkViolations === 0) {
  reportPass('Zero Outbound Telemetry: No network primitives detected in source code');
}

if (evalViolations === 0) {
  reportPass('Anti-Eval Security: No dynamic execution primitives detected in source code');
}

if (domSafetyViolations === 0) {
  reportPass('Anti-XSS DOM Safety: No unsafe innerHTML assignments detected in source code');
}

if (timerViolations === 0) {
  reportPass('Service Worker Lifecycle: No persistent setInterval timers in background');
}

// -------------------------------------------------------------
// Final Verdict
// -------------------------------------------------------------
console.log('----------------------------------------------------');
if (failures > 0) {
  console.error(`[Guardrails: Static] FAILED with ${failures} policy violation(s).`);
  process.exit(1);
} else {
  console.log('[Guardrails: Static] ALL STATIC POLICY CHECKS PASSED.');
}
