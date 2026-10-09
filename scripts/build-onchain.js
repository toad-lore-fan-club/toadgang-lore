#!/usr/bin/env node
/**
 * Export sourced onchain fact sheets as a separate, agent-readable JSONL feed.
 * This is a format/provenance check, NOT independent blockchain verification.
 *
 * node scripts/build-onchain.js [--validate-only] [--verbose]
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function markdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return markdownFiles(full);
      return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
    })
    .sort();
}

function validISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}

function parseFactSheet(markdown, sourceFile) {
  const errors = [];
  const slug = path.posix.basename(sourceFile, '.md');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push('filename must be a lowercase, hyphenated slug');
  }

  const h1 = [...markdown.matchAll(/^#\s+(.+)\s*$/gm)];
  if (h1.length !== 1) errors.push('exactly one level-1 title is required');
  const title = h1[0]?.[1]?.trim() || null;

  // Author-reported date, never a chain verification performed by this script.
  const dateMatches = [...markdown.matchAll(/\bLast verified\s*:?\s*(\d{4}-\d{2}-\d{2})\b/gi)];
  if (dateMatches.length !== 1 || !validISODate(dateMatches[0][1])) {
    errors.push('exactly one valid "Last verified YYYY-MM-DD" date is required');
  }

  // External hyperlinks are evidence pointers, not proof of what they claim.
  const sourceUrls = [...new Set(
    [...markdown.matchAll(/(?<!!)\[[^\]\n]+\]\((https?:\/\/[^\s)]+)\)/g)]
      .map(match => match[1])
  )].sort();
  if (sourceUrls.length === 0) errors.push('at least one external evidence hyperlink is required');

  const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)];
  if (headings.length === 0) errors.push('at least one level-2 section is required');

  if (errors.length > 0) throw new Error(`${sourceFile}: ${errors.join('; ')}`);

  const sections = headings.map((match, i) => ({
    heading: match[1].trim(),
    markdown: markdown.slice(match.index + match[0].length,
      headings[i + 1]?.index ?? markdown.length).trim()
  }));

  return {
    kind: 'onchain_fact_sheet',
    slug,
    title,
    source_file: sourceFile,
    source_sha256: crypto.createHash('sha256').update(markdown).digest('hex'),
    verification_status: 'community-reported; not independently checked by exporter',
    author_reported_last_verified: dateMatches[0][1],
    evidence_urls: sourceUrls,
    sections,
    markdown
  };
}

function build({ root = path.resolve(__dirname, '..'), validateOnly = false, verbose = false } = {}) {
  const files = markdownFiles(path.join(root, 'onchain'));
  if (files.length === 0) throw new Error('No onchain/*.md fact sheets found');
  const records = [];
  const seen = new Set();
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const record = parseFactSheet(fs.readFileSync(file, 'utf8'), relative);
    if (seen.has(record.slug)) throw new Error(`Duplicate onchain slug: ${record.slug}`);
    seen.add(record.slug);
    records.push(record);
    if (verbose) console.log(`✓ ${relative}`);
  }
  if (!validateOnly) {
    const destination = path.join(root, 'dist', 'onchain-facts.jsonl');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, records.map(item => JSON.stringify(item)).join('\n') + '\n');
    console.log(`📄 dist/onchain-facts.jsonl — ${records.length} records`);
  }
  console.log(`✅ ${records.length} onchain fact sheets valid${validateOnly ? ' (no write)' : ''}`);
  return records;
}

if (require.main === module) {
  try {
    build({ validateOnly: process.argv.includes('--validate-only'),
      verbose: process.argv.includes('--verbose') });
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { build, parseFactSheet, validISODate };
