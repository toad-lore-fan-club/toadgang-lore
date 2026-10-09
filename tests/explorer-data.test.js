'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../explorer/data.js');
const samples = [
  {slug:'lore-land-deeds', title:'Lore Land Deeds', category:'artifact', safety:'toadgod hinted · interpret with care', confidence:0.72,last_updated:'2026-10-07',tags:['land','patience'],core_theory:'Deeds hold stories of a pond.',_source_file:'theories/artifact/lore-land-deeds.md'},
  {slug:'aero-hush',title:'Breathe Aero Hush',category:'toadgod',confidence:0.3,last_updated:'2026-10-08',tags:['aero','scroll'],core_theory:'A mysterious scroll and a theory.',_source_file:'theories/toadgod/aero-hush.md'},
  {slug:'sato-fees',title:'Sato Fees to Land',category:'prophecy',confidence:0.25,last_updated:'2026-10-08',tags:['yield'],core_theory:'Is this possible?',_source_file:'theories/prophecy/sato-fees.md'}
];
const toJsonl = arr => arr.map(item => JSON.stringify(item)).join('\n')+'\n';
test('parses real-shaped JSONL records and preserves source path',()=>{
  const rows=D.parseJsonl(toJsonl(samples));
  assert.equal(rows.length,3);assert.equal(rows[0].title,'Lore Land Deeds');assert.equal(rows[0]._source_file,samples[0]._source_file);
});
test('fails closed on malformed JSONL, missing title, duplicate slugs',()=>{
  assert.throws(()=>D.parseJsonl('{bad\n'),/Invalid JSONL/);
  assert.throws(()=>D.parseJsonl(toJsonl([{slug:'test-only'}])),/Invalid theory/);
  assert.throws(()=>D.parseJsonl(toJsonl([samples[0],samples[0]])),/Duplicate theory/);
});
test('searches tags and theory content, AND-matches terms',()=>{
  const rows=D.parseJsonl(toJsonl(samples));
  assert.deepEqual(D.queryRecords(rows,{query:'patience',category:'all'}).map(r=>r.slug),['lore-land-deeds']);
  assert.deepEqual(D.queryRecords(rows,{query:'aero scroll',category:'all'}).map(r=>r.slug),['aero-hush']);
  assert.equal(D.queryRecords(rows,{query:'wrong word'}).length,0);
});
test('filters by category and sorts by confidence, recency and title',()=>{
  const rows=D.parseJsonl(toJsonl(samples));
  assert.equal(D.queryRecords(rows,{category:'toadgod'}).length,1);
  assert.equal(D.queryRecords(rows,{sort:'confidence'})[0].slug,'lore-land-deeds');
  assert.equal(D.queryRecords(rows,{sort:'recent'})[2].slug,'lore-land-deeds');
  assert.equal(D.queryRecords(rows,{sort:'title'})[0].slug,'aero-hush');
  assert.equal(D.categoryCounts(rows).artifact,1);
});
test('labels speculation and keeps community confidence distinct from verified probability',()=>{
  const rows=D.parseJsonl(toJsonl(samples));
  assert.match(D.confidenceLabel(rows[0]),/unconfirmed/);
  assert.match(D.confidenceLabel(rows[1]),/Speculative/);
  assert.match(D.describe(rows[0]),/pond/);
});
test('rejects unsafe sources and URL schemes',()=>{
  assert.equal(D.safeExternalUrl('javascript:alert(1)'),null);
  assert.equal(D.safeExternalUrl('file:///etc/passwd'),null);
  assert.equal(D.safeSourcePath('theories/../../secrets.txt'),null);
  assert.equal(D.safeSourcePath('https://evil.example/theories/test.md'),null);
  assert.equal(D.originalUrl(D.normalizeRecord(samples[0])),'https://github.com/toad-lore-fan-club/toadgang-lore/blob/main/theories/artifact/lore-land-deeds.md');
});
test('extracts deduplicated external evidence URLs',()=>{
  assert.deepEqual(D.sourceUrls('See https://t.me/toadgang/123. Also https://t.me/toadgang/123, and https://basescan.org/tx/0xabc.'),['https://t.me/toadgang/123','https://basescan.org/tx/0xabc']);
});
test('roundtrips deep-link hash and rejects malformed path',()=>{
  const hash=D.hashForSlug('aero-hush');assert.equal(D.slugFromHash(hash),'aero-hush');
  assert.equal(D.slugFromHash('#theory/../../secret'),null);
  assert.equal(D.slugFromHash('#theory/%GG'),null);
});
test('text payloads do not become HTML through data normalization',()=>{
  const data=D.normalizeRecord({...samples[0],title:'<img src=x onerror=alert(1)>'});
  assert.equal(data.title,'<img src=x onerror=alert(1)>');
  assert.equal(D.safeSourcePath('theories/<script>.md'),null);
});


test('reads original Markdown sections and keeps Telegram citations intact',()=>{
  const md = `---\nslug: sample\n---\n## Core theory\nA rumor.\n\n---\n\n## Community source\n- [669154](https://t.me/toadgang/669154) — one-sided pair.\n\n[Primary post](https://t.me/toadgang/676786).\n\n---\n\n## Toadgod evidence\nNone found.`;
  const sections=D.markdownSections(md);
  assert.equal(sections.core_theory,'A rumor.');
  assert.match(sections.community_source_context,/\[669154\]\(https:\/\/t\.me\/toadgang\/669154\)/);
  assert.doesNotMatch(sections.community_source_context,/^---$/m);
  assert.equal(sections.toadgod_evidence,'None found.');
});
test('display link tokenizer retains labeled Markdown links and ordinary text',()=>{
  const tokens=D.inlineSourceTokens('See [669154](https://t.me/toadgang/669154) and https://basescan.org/address/0xabc.');
  const links=tokens.filter(x=>x.kind==='link');
  assert.deepEqual(links.map(x=>x.label),['669154','https://basescan.org/address/0xabc']);
  assert.deepEqual(links.map(x=>x.url),['https://t.me/toadgang/669154','https://basescan.org/address/0xabc']);
  assert.equal(tokens.map(x=>x.kind==='text'?x.value:x.label).join(''),
    'See 669154 and https://basescan.org/address/0xabc.');
});
test('link tokenizer never converts unsafe schemes to active links',()=>{
  const tokens=D.inlineSourceTokens('[bad](javascript:alert(1)) [safe](https://t.me/toadgang/1)');
  assert.equal(tokens.filter(x=>x.kind==='link').length,1);
  assert.equal(tokens.find(x=>x.kind==='link').label,'safe');
});
test('markdown section parser ignores unrelated headings and malformed bodies',()=>{
  assert.deepEqual(D.markdownSections('no headings here'),{});
  assert.deepEqual(D.markdownSections(null),{});
  const s=D.markdownSections('## Core theory\nhello\n## Custom appendix\nignored\n## Why it may be close\nMaybe');
  assert.equal(s.core_theory,'hello');
  assert.equal(s.close_because,'Maybe');
});
