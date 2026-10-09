/* Toadgang Lore Explorer — pure data operations; no dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LoreData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const CATEGORY_NAMES = Object.freeze({
    origin: 'Origin', toadgod: 'Toadgod', prophecy: 'Prophecy', ritual: 'Ritual',
    geography: 'Geography', faction: 'Factions', artifact: 'Artifacts'
  });
  const KNOWN_SAFETY = new Set([
    'speculative · not confirmed', 'community consensus · unverified',
    'toadgod hinted · interpret with care', 'confirmed canon'
  ]);
  function string(value) { return typeof value === 'string' ? value.trim() : ''; }
  function cleanList(value) { return Array.isArray(value) ? value.map(string).filter(Boolean).slice(0, 150) : []; }
  function safeSlug(value) { return SLUG.test(string(value)) ? value : null; }
  function normalizeRecord(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const slug = safeSlug(input.slug);
    if (!slug || !string(input.title)) return null;
    const confidence = Number(input.confidence);
    return {
      slug, title: string(input.title), category: string(input.category),
      confidence: Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : null,
      safety: KNOWN_SAFETY.has(input.safety) ? input.safety : 'speculative · not confirmed',
      tags: cleanList(input.tags), related_theories: cleanList(input.related_theories).filter(Boolean),
      last_updated: /^\d{4}-\d{2}-\d{2}$/.test(string(input.last_updated)) ? input.last_updated : null,
      contributors: cleanList(input.contributors), community_source: string(input.community_source),
      toadgod_signal: string(input.toadgod_signal), core_theory: string(input.core_theory),
      community_source_context: string(input.community_source_context),
      toadgod_evidence: string(input.toadgod_evidence), close_because: string(input.close_because),
      far_because: string(input.far_because), confidence_rationale: string(input.confidence_rationale),
      _source_file: safeSourcePath(input._source_file)
    };
  }
  function parseJsonl(source) {
    if (typeof source !== 'string') throw new TypeError('JSONL input must be a string');
    const seen = new Set();
    return source.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, idx) => {
      let object;
      try { object = JSON.parse(line); }
      catch (e) { throw new Error('Invalid JSONL record ' + (idx + 1) + ': ' + e.message); }
      const item = normalizeRecord(object);
      if (!item) throw new Error('Invalid theory record ' + (idx + 1));
      if (seen.has(item.slug)) throw new Error('Duplicate theory slug: ' + item.slug);
      seen.add(item.slug);
      return item;
    });
  }
  function safeSourcePath(path) {
    const s = string(path);
    return /^theories\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.md$/.test(s) && !s.includes('..') ? s : null;
  }
  function safeExternalUrl(candidate) {
    const s = string(candidate);
    if (!s || s.length > 1800) return null;
    try {
      const u = new URL(s);
      return ['https:', 'http:'].includes(u.protocol) && u.hostname ? u.href : null;
    } catch (_) { return null; }
  }
  function sourceUrls(text) {
    const matches = string(text).match(/https?:\/\/[^\s<>"'\])}]+/g) || [];
    const seen = new Set();
    return matches.map(x => x.replace(/[.,;:!?]+$/, '')).map(safeExternalUrl).filter(x => {
      if (!x || seen.has(x)) return false;
      seen.add(x); return true;
    }).slice(0, 12);
  }
  const READER_HEADINGS = Object.freeze({
    'core theory':'core_theory', 'community source':'community_source_context',
    'toadgod evidence':'toadgod_evidence', 'why it may be close':'close_because',
    'why it may be far off':'far_because', 'confidence rationale':'confidence_rationale'
  });
  function markdownSections(markdown) {
    if (typeof markdown !== 'string' || markdown.length > 250000) return {};
    const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    const result = {};
    let key = null, lines = [];
    function flush() {
      if (!key) return;
      result[key] = lines.filter(x => !/^\s*---+\s*$/.test(x))
        .join('\n').trim();
    }
    for (const line of body.split(/\r?\n/)) {
      const h = /^##\s+(.+?)\s*$/.exec(line);
      if (h) {
        flush(); key = READER_HEADINGS[h[1].trim().toLowerCase()] || null;
        lines = [];
      } else if (key) lines.push(line);
    }
    flush();
    return result;
  }
  function inlineSourceTokens(text) {
    const value = String(text || '');
    // The parser is intentionally modest: Markdown links and naked HTTPS URLs.
    // No Markdown HTML and no external library are interpreted.
    const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>"'\])}]+/g;
    const tokens = [];
    let cursor = 0;
    for (const hit of value.matchAll(pattern)) {
      if (hit.index > cursor) tokens.push({kind:'text',value:value.slice(cursor,hit.index)});
      const rawUrl = hit[2] || hit[0];
      const clean = rawUrl.replace(/[.,;:!?]+$/, '');
      const safe = safeExternalUrl(clean);
      if (safe) tokens.push({kind:'link',label:hit[1] || clean,url:safe});
      else tokens.push({kind:'text',value:hit[0]});
      cursor = hit.index + hit[0].length;
      if (!hit[1] && rawUrl.length > clean.length)
        tokens.push({kind:'text',value:rawUrl.slice(clean.length)});
    }
    if (cursor < value.length) tokens.push({kind:'text',value:value.slice(cursor)});
    return tokens;
  }
  function originalUrl(record) {
    if (!record || !safeSourcePath(record._source_file)) return null;
    return 'https://github.com/toad-lore-fan-club/toadgang-lore/blob/main/' + record._source_file;
  }
  function categoryLabel(category) { return CATEGORY_NAMES[category] || category || 'Lore'; }
  function confidenceLabel(record) {
    if (!record) return 'Community theory';
    if (record.safety === 'confirmed canon') return 'Marked confirmed canon';
    if (record.safety === 'community consensus · unverified') return 'Unverified consensus';
    if (record.safety === 'toadgod hinted · interpret with care') return 'Hinted · unconfirmed';
    return 'Speculative · unconfirmed';
  }
  function describe(record, size) {
    const clean = string(record && record.core_theory).replace(/\s+/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*+/g, '');
    const maximum = size || 160;
    return clean.length > maximum ? clean.slice(0, maximum).replace(/\s+\S*$/, '') + '…' : (clean || 'A community-preserved lore theory. Open to explore its original evidence and counterarguments.');
  }
  function queryRecords(records, opts) {
    const options = opts || {};
    const q = string(options.query).toLocaleLowerCase();
    const cat = string(options.category);
    const sort = string(options.sort) || 'recent';
    return records.filter(r => {
      if (cat && cat !== 'all' && cat !== r.category) return false;
      if (!q) return true;
      const haystack = [r.title, r.category, categoryLabel(r.category), r.slug,
        ...(r.tags || []), r.core_theory, r.community_source_context].join(' ').toLocaleLowerCase();
      return q.split(/\s+/).every(token => haystack.includes(token));
    }).sort((a,b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'confidence') return (b.confidence ?? -1) - (a.confidence ?? -1) || a.title.localeCompare(b.title);
      return (b.last_updated || '').localeCompare(a.last_updated || '') || a.title.localeCompare(b.title);
    });
  }
  function hashForSlug(slug) { return safeSlug(slug) ? '#theory/' + encodeURIComponent(slug) : '#library'; }
  function slugFromHash(hash) {
    if (typeof hash !== 'string' || !hash.startsWith('#theory/')) return null;
    try { return safeSlug(decodeURIComponent(hash.slice(8))); } catch (_) { return null; }
  }
  function categoryCounts(records) {
    return records.reduce((map, r) => { map[r.category] = (map[r.category] || 0) + 1; return map; }, {});
  }
  return { CATEGORY_NAMES, parseJsonl, normalizeRecord, safeSlug, safeSourcePath, safeExternalUrl,
    sourceUrls, originalUrl, categoryLabel, confidenceLabel, describe, queryRecords, hashForSlug,
    slugFromHash, categoryCounts, markdownSections, inlineSourceTokens };
});
