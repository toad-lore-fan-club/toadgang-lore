# The Living Lore — community explorer (preview)

A dependency-free, mobile-first visual explorer for the **Toadgang Lore** archive. This is an optional presentation layer; it does not change lore records or the existing exporter.

## Preview

From the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173/explorer/>. Serve from **repository root**: the explorer reads `../dist/theories.jsonl` directly. Browsing with `file://` is unsupported because browsers block local fetches.

## Features

- Responsive, no-build archive and detail dialog; keyboard navigation and reduced-motion preference.
- Search title, tags, category and theory summaries; category filters and sort choices.
- Deep-link to a theory via `#theory/<slug>`; source and original Markdown links; cross-referenced theories.
- Automatically uses `dist/theories.jsonl`; no hardcoded theory list, no API key, no network request to a third-party data service.
- Uses community infographics stored in `assets/infographics/` when available. All other visuals are locally rendered with CSS and SVG.
- Source-aware and explicitly labels community confidence as non-canonical.

This is a ToadAid community contribution proposal for Kuzikuu and the toad-lore-fan-club maintainers. Their original lore records remain the source of truth. The explorer has no external JavaScript, font, or CSS dependencies and works offline once served locally.

## Test

```sh
node --test tests/explorer-data.test.js
node --check explorer/data.js
node --check explorer/app.js
```
