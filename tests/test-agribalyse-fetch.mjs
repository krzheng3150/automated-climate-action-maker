import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadAll, scanCsv, validateCsv } from '../scripts/fetch-agribalyse.mjs';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

console.log('[Test: AGRIBALYSE Fetch] Verifying download, validation, and provenance logic offline...');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failures++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// ----------------------------------------------------------------------------
// 1. Pure CSV scanning and validation
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 1: CSV scan and validation ---');

const source = { requiredHeaders: ['Code CIQUAL', 'Changement climatique'], minRows: 2 };
const goodCsv = 'Code CIQUAL,Nom,Changement climatique\n1,"Beurre, doux",9.5\n2,Lentilles,0.9\n';

let scan = scanCsv(goodCsv);
assert(scan.rowCount === 2 && scan.headers.length === 3, 'Counts data rows and header cells');

scan = scanCsv('a,b\r\n1,"line one\nline two"\r\n2,"say ""hi"", ok"\r\n');
assert(scan.rowCount === 2, 'Quoted newlines and escaped quotes do not split records');

scan = scanCsv('﻿a,b\n1,2');
assert(scan.headers[0] === 'a' && scan.rowCount === 1, 'BOM stripped and unterminated last row counted');

scan = scanCsv('a,b,c\n1,2,3\n,,\n,,\n"x",,\n,,\n');
assert(scan.rowCount === 2, 'Padding rows of only commas are not counted, but a row with just a quoted cell is');

scan = scanCsv('a,b\n1,2\n\n\n');
assert(scan.rowCount === 1, 'Blank lines are not counted');

assert(validateCsv(goodCsv, source).errors.length === 0, 'Valid CSV passes');
assert(validateCsv('Code CIQUAL,Changement climatique\n1,2\n,\n,\n,\n', source).errors.some((e) => e.includes('data rows')), 'Padding rows cannot satisfy the minimum row count');
assert(validateCsv('Code  CIQUAL ,x,CHANGEMENT climatique\n1,2,3\n4,5,6', source).errors.length === 0, 'Header match ignores case and extra whitespace');
assert(validateCsv('<!doctype html><html></html>', source).errors.length === 1, 'HTML error page is rejected');
assert(validateCsv('Code CIQUAL,Nom\n1,a\n2,b\n', source).errors.some((e) => e.includes('Changement climatique')), 'Missing climate column is reported');
assert(validateCsv('Code CIQUAL,Changement climatique\n1,2\n', source).errors.some((e) => e.includes('data rows')), 'Too few rows is reported');
assert(validateCsv('', source).errors.length > 0, 'Empty body is rejected');

// ----------------------------------------------------------------------------
// 2. Download flow against a local server (no real network)
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 2: Download flow, retries, skip, provenance ---');

const hits = {};
let flakyCalls = 0;
const server = http.createServer((req, res) => {
  hits[req.url] = (hits[req.url] ?? 0) + 1;
  const csv = (body) => {
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8' });
    res.end(body);
  };
  switch (req.url) {
    case '/datasets/ok/raw':
      return csv(goodCsv);
    case '/datasets/ok': {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ title: 'OK set', description: 'Version : **AGRIBALYSE® v3.2**\n\nblah', license: { title: 'Licence Ouverte / Open Licence' }, dataUpdatedAt: '2026-06-30T00:00:00Z' }));
    }
    case '/datasets/flaky/raw':
      flakyCalls++;
      if (flakyCalls === 1) {
        res.writeHead(503);
        return res.end('try later');
      }
      return csv(goodCsv);
    case '/datasets/html/raw':
      res.writeHead(200, { 'content-type': 'text/csv' });
      return res.end('<html>Cloudflare challenge</html>');
    case '/datasets/wrongtype/raw':
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(goodCsv);
    case '/datasets/gone/raw':
      res.writeHead(404);
      return res.end('nope');
    case '/datasets/proprietary/raw':
      return csv(goodCsv);
    case '/datasets/proprietary': {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ license: { title: 'All rights reserved' } }));
    }
    default:
      res.writeHead(404);
      return res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/datasets`;

const outDir = path.join(projectRoot, '.cache', `test-agribalyse-${process.pid}`);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const mk = (id) => ({ id, file: `${id}.csv`, requiredHeaders: source.requiredHeaders, minRows: source.minRows });
const retryOptions = { attempts: 3, backoffMs: 5, timeoutMs: 2000 };

try {
  const sources = ['ok', 'flaky', 'html', 'wrongtype', 'gone', 'proprietary'].map(mk);
  const first = await downloadAll({ sources, baseUrl, outDir, retryOptions });
  const byId = Object.fromEntries(first.results.map((r) => [r.source.id, r]));

  assert(byId.ok.status === 'downloaded', 'Good source downloads');
  assert(byId.ok.entry.rows === 2 && byId.ok.entry.bytes === Buffer.byteLength(goodCsv), 'Entry records row count and byte size');
  assert(
    byId.ok.entry.sha256 === createHash('sha256').update(goodCsv).digest('hex'),
    'Entry sha256 matches an independent hash of the content'
  );
  assert(byId.ok.entry.license === 'Licence Ouverte / Open Licence' && byId.ok.entry.dataUpdatedAt === '2026-06-30T00:00:00Z', 'Portal licence and update date are recorded');
  assert(byId.ok.entry.version === 'v3.2', 'Dataset version is parsed from the portal description');
  assert(readFileSync(path.join(outDir, 'ok.csv'), 'utf8') === goodCsv, 'File content is saved unchanged');

  assert(byId.flaky.status === 'downloaded' && flakyCalls === 2, 'Transient 503 is retried and succeeds');
  assert(byId.html.status === 'failed' && !existsSync(path.join(outDir, 'html.csv')), 'HTML body served as CSV is rejected and not saved');
  assert(byId.wrongtype.status === 'failed' && /content-type/.test(byId.wrongtype.error), 'Unexpected content-type is rejected');
  assert(byId.gone.status === 'failed' && hits['/datasets/gone/raw'] === 1, '404 fails immediately without retrying');
  assert(byId.proprietary.entry.licenseWarning !== undefined, 'Non-open licence from the portal raises a warning');
  assert(first.failures.length === 3, 'Failures are returned, not thrown');
  assert(readdirSync(outDir).every((f) => !f.endsWith('.tmp')), 'No temp files left behind');

  const manifest = JSON.parse(readFileSync(first.manifestPath, 'utf8'));
  assert(Object.keys(manifest.files).sort().join() === 'flaky.csv,ok.csv,proprietary.csv', 'Manifest lists only the successful downloads');
  assert(manifest.notice === 'data/NOTICE' && manifest.attribution === undefined, 'Manifest points to data/NOTICE instead of restating the credit');

  const hitsBefore = hits['/datasets/ok/raw'];
  const second = await downloadAll({ sources: [mk('ok')], baseUrl, outDir, retryOptions });
  assert(second.results[0].status === 'skipped' && hits['/datasets/ok/raw'] === hitsBefore, 'Unchanged existing file is skipped without re-downloading');

  writeFileSync(path.join(outDir, 'ok.csv'), 'corrupted');
  const third = await downloadAll({ sources: [mk('ok')], baseUrl, outDir, retryOptions });
  assert(third.results[0].status === 'downloaded' && readFileSync(path.join(outDir, 'ok.csv'), 'utf8') === goodCsv, 'Corrupted existing file is detected and re-downloaded');

  const forced = await downloadAll({ sources: [mk('ok')], baseUrl, outDir, force: true, retryOptions });
  assert(forced.results[0].status === 'downloaded', '--force re-downloads even when the file is intact');

  const keep = JSON.parse(readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
  assert(keep.files['flaky.csv'] !== undefined, 'Manifest keeps entries from earlier runs for sources not in this run');
} finally {
  server.close();
  rmSync(outDir, { recursive: true, force: true });
}

console.log('----------------------------------------------------');
if (failures > 0) {
  console.error(`[Test: AGRIBALYSE Fetch] FAILED with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('[Test: AGRIBALYSE Fetch] ALL CHECKS PASSED.');
}
