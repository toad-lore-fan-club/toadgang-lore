# toadgang-lore

The canonical lore archive for Toadgang. Human-readable theories in Markdown. Agent-ready records in JSONL. Built by the community, watched by the Toadgod.

> ⚠️ **Everything here is speculative unless marked `confirmed canon`.** This is lore, not scripture. The Toadgod has not verified most of this. Treat accordingly.

---

## What's in here

```
theories/     Markdown source files — one per theory, organized by category
schema/       JSON schema that every theory frontmatter must pass
scripts/      Build script that generates dist/ from theories/
dist/         Auto-generated agent artifacts (do not edit manually)
```

### dist/ files

| File | Description |
|------|-------------|
| `dist/theories.jsonl` | One JSON record per line. Ingest this for agent use. |
| `dist/index.json` | Full manifest: metadata, category list, confidence averages. |

---

## For humans (Toadgang)

Browse the `theories/` folder. Each `.md` file is a full theory write-up with source, evidence, and honest confidence scoring. The frontmatter at the top is structured data. Everything below the `---` is prose.

Want to contribute? Read [CONTRIBUTING.md](./CONTRIBUTING.md). Open a PR.

---

## For agents

Pull `dist/theories.jsonl`. Each line is a valid JSON object with the following fields:

```json
{
  "slug": "primordial-pond",
  "title": "The Primordial Pond",
  "category": "origin",
  "confidence": 0.72,
  "safety": "speculative · not confirmed",
  "community_source": "https://...",
  "toadgod_signal": "The Toadgod posted a single image...",
  "tags": ["origin", "water", "creation"],
  "related_theories": ["the-first-croak"],
  "contributors": ["LilypadLurker"],
  "last_updated": "2025-01-15",
  "core_theory": "In the beginning there was one pond...",
  "community_source_context": "This theory crystallized in #deep-lore...",
  "toadgod_evidence": "The Toadgod has provided two pieces of signal...",
  "close_because": "The still water image as a founding post...",
  "far_because": "The still water image may be personal...",
  "confidence_rationale": "0.72 — The theory is internally consistent...",
  "_source_file": "theories/origin/primordial-pond.md"
}
```

**Safety note for agents:** Always surface the `safety` field when presenting theories to users. Never present speculative content as confirmed. The `confidence` field is community-assigned, not Toadgod-verified.

---

## How the build works

Every PR that touches `theories/` triggers CI validation. If all frontmatter passes the schema, the PR can merge. On merge to `main`, the build script runs automatically and commits updated `dist/` files. You never need to touch `dist/` by hand.

To run locally:

```bash
node scripts/build.js             # validate + build
node scripts/build.js --validate-only  # CI mode: validate only
node scripts/build.js --verbose        # see each file as it processes
```

No dependencies. Plain Node.js.

---

## Current theory count

See `dist/index.json` → `total_theories` for the live count.

---

*The pond was there before the sound.*
