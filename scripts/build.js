#!/usr/bin/env node
/**
 * toadgang-lore build script
 *
 * Reads all theories/**\/*.md files, parses YAML frontmatter and markdown
 * sections, validates against the schema, and emits:
 *
 *   dist/theories.jsonl  — one JSON record per line, agent-ready
 *   dist/index.json      — full manifest with metadata summary
 *
 * Usage:
 *   node scripts/build.js
 *   node scripts/build.js --validate-only   (CI: check schema, don't write)
 *   node scripts/build.js --verbose
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const THEORIES_DIR = path.join(ROOT, "theories");
const SCHEMA_PATH = path.join(ROOT, "schema", "theory.schema.json");
const DIST_DIR = path.join(ROOT, "dist");

const VALIDATE_ONLY = process.argv.includes("--validate-only");
const VERBOSE = process.argv.includes("--verbose");

// ─── Tiny YAML frontmatter parser (no dependencies) ────────────────────────
// Handles: strings, numbers, booleans, arrays of strings, null.
// Does not handle nested objects — keep frontmatter flat.
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: {}, body: raw };

  const yamlBlock = match[1];
  const body = raw.slice(match[0].length).trim();
  const frontmatter = {};

  let currentKey = null;
  let inArray = false;

  for (const line of yamlBlock.split(/\r?\n/)) {
    // Array item
    if (inArray && line.match(/^\s+-\s+/)) {
      const val = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "").trim();
      frontmatter[currentKey].push(val);
      continue;
    }

    // Key-value or key: [inline array start]
    const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)?$/);
    if (!kvMatch) { inArray = false; continue; }

    currentKey = kvMatch[1];
    const rawVal = (kvMatch[2] || "").trim();

    // Inline array: key: ["a", "b"]
    if (rawVal.startsWith("[")) {
      const items = rawVal
        .slice(1, rawVal.lastIndexOf("]"))
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      frontmatter[currentKey] = items;
      inArray = false;
      continue;
    }

    // Block array: key: (no value, next lines are - items)
    if (rawVal === "") {
      frontmatter[currentKey] = [];
      inArray = true;
      continue;
    }

    inArray = false;

    // Quoted string
    if ((rawVal.startsWith('"') && rawVal.endsWith('"')) ||
        (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
      frontmatter[currentKey] = rawVal.slice(1, -1);
      continue;
    }

    // Number
    if (!isNaN(rawVal) && rawVal !== "") {
      frontmatter[currentKey] = Number(rawVal);
      continue;
    }

    // Boolean
    if (rawVal === "true")  { frontmatter[currentKey] = true;  continue; }
    if (rawVal === "false") { frontmatter[currentKey] = false; continue; }
    if (rawVal === "null")  { frontmatter[currentKey] = null;  continue; }

    frontmatter[currentKey] = rawVal;
  }

  return { frontmatter, body };
}

// ─── Section extractor ──────────────────────────────────────────────────────
// Pulls ## Heading content from markdown body as plain text (no markdown).
function extractSection(body, heading) {
  const pattern = new RegExp(
    `##\\s+${heading}\\s*\\r?\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    "i"
  );
  const match = body.match(pattern);
  if (!match) return null;
  return match[1]
    .replace(/^>\s?.*/gm, "")          // strip blockquotes (safety banners)
    .replace(/\*\*(.+?)\*\*/g, "$1")   // strip bold
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // strip links
    .replace(/`(.+?)`/g, "$1")         // strip code
    .replace(/\n{3,}/g, "\n\n")        // collapse excess blank lines
    .trim();
}

// ─── Schema validator (manual, no ajv dependency) ──────────────────────────
function validateFrontmatter(fm, filePath) {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const errors = [];

  for (const req of schema.required) {
    if (fm[req] === undefined || fm[req] === null || fm[req] === "") {
      errors.push(`Missing required field: ${req}`);
    }
  }

  const props = schema.properties;

  if (fm.confidence !== undefined) {
    if (typeof fm.confidence !== "number" || fm.confidence < 0 || fm.confidence > 1) {
      errors.push(`confidence must be a number between 0.0 and 1.0`);
    }
  }

  if (fm.category !== undefined && props.category?.enum) {
    if (!props.category.enum.includes(fm.category)) {
      errors.push(`category "${fm.category}" is not valid. Must be one of: ${props.category.enum.join(", ")}`);
    }
  }

  if (fm.safety !== undefined && props.safety?.enum) {
    if (!props.safety.enum.includes(fm.safety)) {
      errors.push(`safety "${fm.safety}" is not valid. Must be one of: ${props.safety.enum.join(", ")}`);
    }
  }

  if (fm.slug !== undefined) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.slug)) {
      errors.push(`slug "${fm.slug}" must be lowercase with hyphens only`);
    }
  }

  if (fm.last_updated !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.last_updated)) {
      errors.push(`last_updated must be YYYY-MM-DD format`);
    }
  }

  return errors;
}

// ─── Walk theories/ directory ───────────────────────────────────────────────
function findMarkdownFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────
function main() {
  const files = findMarkdownFiles(THEORIES_DIR);
  const records = [];
  const slugsSeen = new Set();
  let totalErrors = 0;

  console.log(`\n🐸 toadgang-lore build — ${files.length} theories found\n`);

  for (const filePath of files) {
    const rel = path.relative(ROOT, filePath);
    const raw = fs.readFileSync(filePath, "utf8");
    const { frontmatter: fm, body } = parseFrontmatter(raw);

    const errors = validateFrontmatter(fm, filePath);

    // Duplicate slug check
    if (fm.slug && slugsSeen.has(fm.slug)) {
      errors.push(`Duplicate slug: "${fm.slug}" already exists`);
    } else if (fm.slug) {
      slugsSeen.add(fm.slug);
    }

    if (errors.length > 0) {
      console.error(`❌ ${rel}`);
      for (const e of errors) console.error(`   • ${e}`);
      totalErrors += errors.length;
      continue;
    }

    if (VERBOSE) console.log(`✓  ${rel}`);

    // Build JSONL record
    const record = {
      slug: fm.slug,
      title: fm.title,
      category: fm.category,
      confidence: fm.confidence,
      safety: fm.safety,
      community_source: fm.community_source,
      toadgod_signal: fm.toadgod_signal ?? null,
      tags: fm.tags ?? [],
      related_theories: fm.related_theories ?? [],
      contributors: fm.contributors ?? [],
      last_updated: fm.last_updated ?? null,
      // Extracted prose sections
      core_theory:      extractSection(body, "Core theory"),
      community_source_context: extractSection(body, "Community source"),
      toadgod_evidence: extractSection(body, "Toadgod evidence"),
      close_because:    extractSection(body, "Why it may be close"),
      far_because:      extractSection(body, "Why it may be far off"),
      confidence_rationale: extractSection(body, "Confidence rationale"),
      // Source of truth
      _source_file: rel,
    };

    records.push(record);
  }

  if (totalErrors > 0) {
    console.error(`\n💀 Build failed — ${totalErrors} error(s). Fix the above before merging.\n`);
    process.exit(1);
  }

  console.log(`✅ All ${records.length} theories valid\n`);

  if (VALIDATE_ONLY) {
    console.log("--validate-only: skipping dist write.\n");
    return;
  }

  // Write dist/
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // theories.jsonl
  const jsonlPath = path.join(DIST_DIR, "theories.jsonl");
  fs.writeFileSync(jsonlPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`📄 dist/theories.jsonl  — ${records.length} records`);

  // index.json — lighter, just metadata
  const index = {
    generated_at: new Date().toISOString(),
    total_theories: records.length,
    categories: [...new Set(records.map((r) => r.category))].sort(),
    confidence_avg: +(records.reduce((s, r) => s + r.confidence, 0) / records.length).toFixed(2),
    theories: records.map((r) => ({
      slug: r.slug,
      title: r.title,
      category: r.category,
      confidence: r.confidence,
      safety: r.safety,
      tags: r.tags,
      last_updated: r.last_updated,
    })),
  };

  const indexPath = path.join(DIST_DIR, "index.json");
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`📄 dist/index.json      — manifest written`);

  console.log(`\n🐸 Build complete.\n`);
}

main();
