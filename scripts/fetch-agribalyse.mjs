import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

export const ADEME_DATASETS_URL = 'https://data.ademe.fr/data-fair/api/v1/datasets';
export const DEFAULT_OUT_DIR = path.join(projectRoot, 'data', 'raw', 'agribalyse');

/**
 * ADEME open-data CSVs (comma-delimited, French headers). Dataset ids say "31" on the portal
 * even when the content is newer: always read the version/date recorded in manifest.json.
 */
export const AGRIBALYSE_SOURCES = [
  {
    id: 'agribalyse-31-synthese',
    file: 'synthese.csv',
    requiredHeaders: ['Code CIQUAL', 'LCI Name', 'Changement climatique'],
    minRows: 2000,
  },
  {
    id: 'agribalyse-31-detail-par-ingredient',
    file: 'detail-ingredient.csv',
    requiredHeaders: ['Ciqual code', 'Ingredients', 'Changement climatique'],
    minRows: 5000,
  },
  {
    id: 'agribalyse-31-detail-par-etape',
    file: 'detail-etape.csv',
    requiredHeaders: ['Code CIQUAL', 'Changement climatique - Agriculture', 'Changement climatique - Transport'],
    minRows: 2000,
  },
];

const normalizeHeader = (h) => h.replace(/\s+/g, ' ').trim().toLowerCase();

/** Header cells and data-record count. All-empty padding rows are not counted. */
export function scanCsv(text) {
  const { headers, rows } = parseCsv(text);
  return { headers, rowCount: rows.length };
}

/** Returns a list of problems; an empty list means the file looks like the expected CSV. */
export function validateCsv(text, source) {
  const errors = [];
  if (/^\s*</.test(text)) {
    errors.push('response looks like HTML/XML, not CSV');
    return { errors, rowCount: 0, headers: [] };
  }
  const { headers, rowCount } = scanCsv(text);
  const have = new Set(headers.map(normalizeHeader));
  for (const required of source.requiredHeaders) {
    if (!have.has(normalizeHeader(required))) errors.push(`missing expected column "${required}"`);
  }
  if (rowCount < source.minRows) errors.push(`only ${rowCount} data rows, expected at least ${source.minRows}`);
  return { errors, rowCount, headers };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries network errors, 429 and 5xx. Other statuses fail immediately. */
export async function fetchWithRetry(url, { attempts = 3, timeoutMs = 60000, backoffMs = 500 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let retryable = true;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} for ${url}`);
      retryable = res.status === 429 || res.status >= 500;
    } catch (err) {
      lastError = err;
    }
    if (!retryable) throw lastError;
    if (attempt < attempts) await sleep(backoffMs * attempt);
  }
  throw lastError;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function readManifest(manifestPath) {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return { files: {} };
  }
}

async function fetchMetadata(baseUrl, source, retryOptions) {
  try {
    const res = await fetchWithRetry(`${baseUrl}/${source.id}`, retryOptions);
    const meta = await res.json();
    return {
      title: meta.title ?? null,
      version: /Version\s*:\s*\**\s*AGRIBALYSE\W*\s*(v[\d.]+)/i.exec(meta.description ?? '')?.[1] ?? null,
      license: meta.license?.title ?? null,
      dataUpdatedAt: meta.dataUpdatedAt ?? meta.updatedAt ?? null,
    };
  } catch (err) {
    return { title: null, license: null, dataUpdatedAt: null, metadataError: err.message };
  }
}

async function downloadSource(source, { baseUrl, outDir, force, previous, retryOptions }) {
  const target = path.join(outDir, source.file);

  if (!force && existsSync(target) && previous) {
    const existing = readFileSync(target);
    const check = validateCsv(existing.toString('utf8'), source);
    if (sha256(existing) === previous.sha256 && check.errors.length === 0) {
      return { entry: { ...previous, rows: check.rowCount }, status: 'skipped' };
    }
  }

  const res = await fetchWithRetry(`${baseUrl}/${source.id}/raw`, retryOptions);
  const contentType = res.headers.get('content-type') ?? '';
  if (!/csv|text\/plain|octet-stream/i.test(contentType)) {
    throw new Error(`unexpected content-type "${contentType}"`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const { errors, rowCount } = validateCsv(bytes.toString('utf8'), source);
  if (errors.length > 0) throw new Error(errors.join('; '));

  // Write to a temp file and rename, so an interrupted run never leaves a half-written CSV.
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, target);

  const meta = await fetchMetadata(baseUrl, source, retryOptions);
  const entry = {
    datasetId: source.id,
    url: `${baseUrl}/${source.id}/raw`,
    file: source.file,
    bytes: bytes.length,
    sha256: sha256(bytes),
    rows: rowCount,
    fetchedAt: new Date().toISOString(),
    ...meta,
  };
  if (meta.license && !/ouverte|open licen|etalab/i.test(meta.license)) {
    entry.licenseWarning = `portal reports licence "${meta.license}", expected an Etalab open licence`;
  }
  return { entry, status: 'downloaded' };
}

/**
 * Downloads every source into outDir and records provenance in manifest.json.
 * Never throws for a single bad source: failures are returned so the CLI can exit non-zero
 * while keeping the files that succeeded.
 */
export async function downloadAll({
  sources = AGRIBALYSE_SOURCES,
  baseUrl = ADEME_DATASETS_URL,
  outDir = DEFAULT_OUT_DIR,
  force = false,
  retryOptions = {},
} = {}) {
  mkdirSync(outDir, { recursive: true });
  const manifestPath = path.join(outDir, 'manifest.json');
  const manifest = readManifest(manifestPath);
  manifest.files ??= {};

  const results = [];
  for (const source of sources) {
    try {
      const { entry, status } = await downloadSource(source, {
        baseUrl,
        outDir,
        force,
        previous: manifest.files[source.file],
        retryOptions,
      });
      manifest.files[source.file] = entry;
      results.push({ source, status, entry });
    } catch (err) {
      rmSync(path.join(outDir, `${source.file}.tmp`), { force: true });
      results.push({ source, status: 'failed', error: err.message });
    }
  }

  // The credit wording lives only in data/NOTICE; the manifest just points at it.
  delete manifest.attribution;
  manifest.notice = 'data/NOTICE';
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { results, manifestPath, failures: results.filter((r) => r.status === 'failed') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const force = process.argv.includes('--force');
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const outDir = outArg ? path.resolve(outArg.slice('--out='.length)) : DEFAULT_OUT_DIR;

  console.log(`[AGRIBALYSE] Fetching ${AGRIBALYSE_SOURCES.length} datasets into ${path.relative(projectRoot, outDir) || outDir}`);
  const { results, manifestPath, failures } = await downloadAll({ outDir, force });

  for (const r of results) {
    if (r.status === 'failed') {
      console.error(`[FAIL] ${r.source.file}: ${r.error}`);
      continue;
    }
    const e = r.entry;
    console.log(
      `[${r.status === 'skipped' ? 'SKIP' : 'OK'}] ${e.file}: ${e.rows} rows, ${(e.bytes / 1024).toFixed(0)} KB, ` +
        `${e.version ?? 'unknown version'}, portal updated ${e.dataUpdatedAt ?? 'unknown'}, licence ${e.license ?? 'unknown'}`
    );
    if (e.licenseWarning) console.warn(`[WARN] ${e.file}: ${e.licenseWarning}`);
    if (e.metadataError) console.warn(`[WARN] ${e.file}: could not read portal metadata (${e.metadataError})`);
  }
  console.log(`[AGRIBALYSE] Manifest written to ${path.relative(projectRoot, manifestPath)}`);
  if (failures.length > 0) {
    console.error(`[AGRIBALYSE] ${failures.length} download(s) failed.`);
    process.exit(1);
  }
}
