'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build, parseFactSheet, validISODate } = require('../scripts/build-onchain');

const valid = `# The TOBY Reserve (on-chain facts)

Data based on public Base transactions: [tx](https://basescan.org/tx/0xabc).

## Launch
A wallet received tokens. [wallet](https://basescan.org/address/0x123)

## Status
Claims may become stale.

*Data sheet by community. Last verified 2026-10-08.*
`;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toad-lore-onchain-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'onchain');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'toby-reserve.md'), valid);
  return root;
}

test('makes structured, attributable records without declaring independent verification', () => {
  const record = parseFactSheet(valid, 'onchain/toby-reserve.md');
  assert.equal(record.slug, 'toby-reserve');
  assert.equal(record.title, 'The TOBY Reserve (on-chain facts)');
  assert.equal(record.author_reported_last_verified, '2026-10-08');
  assert.match(record.verification_status, /not independently checked/);
  assert.equal(record.source_sha256.length, 64);
  assert.deepEqual(record.evidence_urls, [
    'https://basescan.org/address/0x123', 'https://basescan.org/tx/0xabc'
  ]);
  assert.deepEqual(record.sections.map(s => s.heading), ['Launch', 'Status']);
  assert.equal(record.markdown, valid);
});

test('rejects missing title, author date, evidence links and sections', () => {
  for (const snippet of [
    valid.replace('# The TOBY Reserve (on-chain facts)', 'The TOBY Reserve'),
    valid.replace('Last verified 2026-10-08', 'Last checked maybe'),
    valid.replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, 'no linked evidence'),
    valid.replace(/^## /gm, '### ')
  ]) assert.throws(() => parseFactSheet(snippet, 'onchain/toby-reserve.md'));
});

test('rejects impossible dates', () => {
  assert.equal(validISODate('2026-02-30'), false);
  assert.throws(() => parseFactSheet(valid.replace('2026-10-08', '2026-02-30'), 'onchain/toby-reserve.md'));
});

test('validate-only has no write side effects', t => {
  const root = fixture(t);
  assert.equal(build({ root, validateOnly: true }).length, 1);
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});

test('build emits deterministic JSONL', t => {
  const root = fixture(t);
  build({ root });
  const output = path.join(root, 'dist', 'onchain-facts.jsonl');
  const first = fs.readFileSync(output, 'utf8');
  build({ root });
  assert.equal(fs.readFileSync(output, 'utf8'), first);
  assert.equal(JSON.parse(first.trim()).slug, 'toby-reserve');
});

test('invalid input fails without overwriting existing export', t => {
  const root = fixture(t);
  const output = path.join(root, 'dist', 'onchain-facts.jsonl');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, 'previous export\n');
  fs.writeFileSync(path.join(root, 'onchain', 'bad.md'), '# Bad');
  assert.throws(() => build({ root }));
  assert.equal(fs.readFileSync(output, 'utf8'), 'previous export\n');
});
