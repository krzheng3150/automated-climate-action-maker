import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { INBOX_PATH } from './discover-swaps.mjs';
import { SWAPS_PATH, generateSwaps } from './generate-swaps.mjs';

/**
 * Curation: the deliberate, human half of the swap pipeline. Nothing reaches data/swaps.json
 * unless someone runs `accept`, after reading the source page and agreeing the recipe really is
 * an alternate of the dish.
 *
 *   node scripts/curate-swaps.mjs list
 *   node scripts/curate-swaps.mjs accept <inbox-index>
 */

const [command, indexArg] = process.argv.slice(2);
const inbox = existsSync(INBOX_PATH) ? JSON.parse(readFileSync(INBOX_PATH, 'utf8')) : [];

if (command === 'list') {
  inbox.forEach((r, i) => {
    if (r.status !== 'candidate') return;
    console.log(`${String(i).padStart(3)}  ${r.ruleId}  share=${r.share}  from=${r.fromGrams}g  servings=${r.servings ?? '?'}  ${r.url}`);
  });
} else if (command === 'accept') {
  const candidate = inbox[Number(indexArg)];
  if (!candidate || candidate.status !== 'candidate') {
    console.error('accept needs the index of a "candidate" entry (see: list)');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(SWAPS_PATH, 'utf8'));
  const rule = data.rules.find((r) => r.id === candidate.ruleId);
  if (!rule) throw new Error(`rule ${candidate.ruleId} no longer exists`);
  if (rule.evidence.some((e) => e.url === candidate.url)) {
    console.error('that page is already evidence for this rule');
    process.exit(1);
  }
  const dryOnly = candidate.toFoods.every((f) => f.endsWith('-dry'));
  rule.evidence.push({
    source: candidate.name || candidate.source,
    url: candidate.url,
    checked: new Date().toISOString().slice(0, 10),
    dish: '',
    fromFood: candidate.fromFood,
    fromGrams: candidate.fromGrams,
    toFood: candidate.toFoods[0],
    toGrams: candidate.toGramsListed,
    toMassFactor: dryOnly ? 2.4 : 1,
    servings: candidate.servings ?? null,
    note: 'accepted from discovery inbox',
  });
  const backup = readFileSync(SWAPS_PATH, 'utf8');
  writeFileSync(SWAPS_PATH, JSON.stringify(data, null, 2) + '\n');
  try {
    const result = generateSwaps();
    console.log(`Accepted. Registry rebuilt (${result.rules} rule(s)); fill in "dish" for the new entry in data/swaps.json.`);
  } catch (err) {
    writeFileSync(SWAPS_PATH, backup);
    console.error(`Rejected, data/swaps.json restored: ${err.message}`);
    process.exit(1);
  }
} else {
  console.error('usage: node scripts/curate-swaps.mjs list | accept <inbox-index>');
  process.exit(1);
}
