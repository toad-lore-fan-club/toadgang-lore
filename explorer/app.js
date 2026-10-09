/* The Living Lore — no framework, no tracking, no dynamic HTML interpretation. */
(function () {
  'use strict';
  const D = window.LoreData;
  const $ = (s) => document.querySelector(s);
  const state = { records: [], ready: false, category: 'all', query: '', sort: 'recent', lastTrigger: null, openedSlug: null };
  const covers = Object.freeze({
    'sato-fees-to-land': '../assets/infographics/sato-fees-card.png',
    'breathe-aero-hush': '../assets/infographics/breathe-aero-hush.png'
  });
  const icons = Object.freeze({ artifact:'✧', prophecy:'✷', toadgod:'☾', geography:'◇', faction:'❖', origin:'✺', ritual:'✳' });
  const sections = [
    ['core_theory','The theory'],
    ['community_source_context','Where the story began'],
    ['toadgod_evidence','What the evidence says'],
    ['close_because','Why it may be close'],
    ['far_because','Why it may be far off'],
    ['confidence_rationale','Understanding the confidence']
  ];
  function element(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined && content !== null) el.textContent = String(content);
    return el;
  }
  function add(parent, node) { parent.appendChild(node); return node; }
  function hrefLink(label, href, cls) {
    const validated = D.safeExternalUrl(href);
    if (!validated) return null;
    const a = element('a',cls,label);
    a.href = validated;
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  }
  function appendLinkified(node, text) {
    // Render text and source-authored Markdown links as DOM nodes only.
    // Never trust or interpret HTML from repository Markdown.
    for (const token of D.inlineSourceTokens(text)) {
      if (token.kind === 'link') {
        const a = hrefLink(token.label, token.url);
        add(node, a || document.createTextNode(token.label));
      } else add(node, document.createTextNode(token.value
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')));
    }
  }
  function chip(category, count) {
    const btn = element('button','chip'); btn.type = 'button';
    btn.setAttribute('aria-pressed', String(state.category === category));
    add(btn, element('span','',category === 'all' ? 'All stories' : D.categoryLabel(category)));
    add(btn, element('span','chip-count',count));
    btn.addEventListener('click', () => { state.category = category; renderChips(); renderCards(); });
    return btn;
  }
  function renderChips() {
    const counts = D.categoryCounts(state.records);
    const root = $('#category-chips'); root.replaceChildren();
    add(root, chip('all', state.records.length));
    Object.keys(counts).sort((a,b) => D.categoryLabel(a).localeCompare(D.categoryLabel(b)))
      .forEach(key => add(root,chip(key,counts[key])));
  }
  function card(record, index) {
    const article = element('article','lore-card');
    const cover = add(article,element('div','card-cover'));
    cover.dataset.category = record.category;
    if (covers[record.slug]) {
      cover.classList.add('has-image');
      const img = element('img'); img.src = covers[record.slug]; img.alt = '';
      img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => { cover.classList.remove('has-image'); img.remove(); add(cover,element('span','cover-symbol',icons[record.category] || '✳')); });
      add(cover,img);
    } else add(cover, element('span','cover-symbol',icons[record.category] || '✳'));
    add(cover,element('span','cover-index','VOL. 001  /  ' + String(index + 1).padStart(2,'0')));
    const content = add(article,element('div','card-content'));
    const top = add(content,element('div','card-top'));
    add(top,element('span','category-tag',D.categoryLabel(record.category)));
    add(top,element('time','card-date',record.last_updated || 'Undated'));
    const h3 = add(content,element('h3','card-title',record.title));
    h3.id = 'card-' + record.slug;
    add(content,element('p','card-summary',D.describe(record,178)));
    const bottom = add(content,element('div','card-bottom'));
    const safety = add(bottom,element('span','safety-indicator'));
    add(safety,element('span','small-circle'));
    add(safety,element('span','',D.confidenceLabel(record)));
    const open = add(bottom,element('button','card-open','Read story ↗'));
    open.type = 'button'; open.setAttribute('aria-label','Read ' + record.title);
    open.addEventListener('click', () => show(record,open));
    // The card is keyboard-operable through its explicit Read button.
    article.addEventListener('click', e => { if (e.target.closest('button, a')) return; show(record,open); });
    return article;
  }
  function renderCards() {
    if (!state.ready) return;
    const rows = D.queryRecords(state.records,{query:state.query,category:state.category,sort:state.sort});
    const grid = $('#lore-cards');
    const fragment = document.createDocumentFragment();
    rows.forEach((r,i) => fragment.appendChild(card(r,i)));
    grid.replaceChildren(fragment);
    $('#shown-count').textContent = rows.length;
    $('#library-message').hidden = true;
    $('#empty-state').hidden = rows.length > 0;
  }
  function populateDetailSection(section, title, content) {
    section.replaceChildren();
    add(section,element('h3','',title));
    // Omit Markdown thematic rules; keep paragraphs and authentic source links.
    const cleaned = String(content).split(/\r?\n/)
      .filter(line => !/^\s*---+\s*$/.test(line)).join('\n').trim();
    cleaned.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).forEach(p => {
      const paragraph = add(section,element('p'));
      appendLinkified(paragraph,p);
    });
  }
  function detailSection(container, title, content, key) {
    if (!content) return;
    const section = add(container,element('section','detail-section'));
    if (key) section.dataset.detailKey = key;
    populateDetailSection(section,title,content);
  }
  async function hydrateSourceLinks(record, body) {
    // JSONL is the official agent data contract, but its compiler deliberately
    // removes Markdown link destinations. Load the original author Markdown
    // for display only so numbered Telegram citations stay clickable.
    const source = D.safeSourcePath(record._source_file);
    if (!source) return;
    try {
      const response = await fetch('../' + source,{cache:'no-cache'});
      if (!response.ok) return; // The agent JSONL remains a working fallback.
      const markdown = await response.text();
      if (markdown.length > 250000) return;
      const linked = D.markdownSections(markdown);
      if (!$('#lore-dialog').open || state.openedSlug !== record.slug ||
          body !== $('#dialog-body')) return;
      const oldScroll = $('#lore-dialog').scrollTop;
      sections.forEach(([key,label]) => {
        const node = body.querySelector('[data-detail-key="' + key + '"]');
        if (node && linked[key]) populateDetailSection(node,label,linked[key]);
      });
      $('#lore-dialog').scrollTop = oldScroll;
    } catch (_) {
      // Offline or missing Markdown: the JSONL reader stays available.
    }
  }
  function show(record, trigger) {
    if (!record) return;
    const dialog = $('#lore-dialog');
    state.lastTrigger = trigger || document.activeElement;
    state.openedSlug = record.slug;
    const root = $('#dialog-body'); root.replaceChildren();
    add(root,element('div','detail-top',D.categoryLabel(record.category) + '  /  THE LIVING LORE'));
    const title = add(root,element('h2','detail-title',record.title)); title.id = 'dialog-title';
    const meta = add(root,element('div','detail-meta'));
    add(meta,element('span','meta-pill',D.confidenceLabel(record)));
    if (record.confidence !== null) add(meta,element('span','meta-pill','Community score: ' + record.confidence.toFixed(2) + ' / 1'));
    if (record.last_updated) add(meta,element('span','meta-pill','Updated ' + record.last_updated));
    const warning = add(root,element('aside','detail-warning'));
    warning.textContent = record.safety === 'confirmed canon'
      ? 'Marked confirmed canon in the community archive. Consult original evidence for the scope of confirmation.'
      : 'This is a community theory, not an official Toadgod statement. The confidence score is community-assigned, not an independently verified probability.';
    if (covers[record.slug]) {
      const img = add(root,element('img','detail-hero-img'));
      img.src = covers[record.slug]; img.alt = 'Community-provided infographic for this theory'; img.loading = 'lazy';
      img.addEventListener('error',() => img.remove());
    }
    sections.forEach(([key,label]) => detailSection(root,label,record[key],key));
    const sources = add(root,element('section','detail-section'));
    add(sources,element('h3','','Follow the original sources'));
    const links = add(sources,element('div','detail-sources'));
    const original = D.originalUrl(record);
    if (original) {const a=hrefLink('Read the original Markdown ↗',original); if(a)add(links,a);}
    const urls = D.sourceUrls([record.community_source,record.community_source_context,record.toadgod_signal,record.toadgod_evidence].join(' '));
    urls.forEach((url,i) => {const a=hrefLink('Evidence source ' + (i+1) + ' ↗',url); if(a)add(links,a);});
    if (!original && urls.length===0) add(sources,element('p','','No direct source URL was supplied. Consult the archive maintainers for attribution.'));
    const related = record.related_theories.map(slug => state.records.find(r => r.slug === slug)).filter(Boolean);
    if (related.length) {
      const section = add(root,element('section','detail-section'));
      add(section,element('h3','','Follow the next thread'));
      const wrap = add(section,element('div','detail-related'));
      related.forEach(other => {
        const btn = add(wrap,element('button','',other.title + ' ↗'));
        btn.type='button'; btn.addEventListener('click',() => show(other,btn));
      });
    }
    if (record.contributors.length) detailSection(root,'Community keepers',record.contributors.join(' · '));
    const buttons = add(root,element('div','detail-actions'));
    const share = add(buttons,element('button','button button-primary','Copy story link ↗'));
    share.addEventListener('click',async () => {
      const url=window.location.origin + window.location.pathname + D.hashForSlug(record.slug);
      const toast=$('#detail-toast');
      try { await navigator.clipboard.writeText(url); toast.textContent='Link copied to clipboard.'; }
      catch(_){ toast.textContent='Copy this address: '+url; }
    });
    const foot = add(root,element('p','detail-footnote','Archive content belongs to its community contributors. Read source material critically.'));
    add(root,element('p','detail-toast')).id='detail-toast';
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('dialog-open');
    if (window.location.hash !== D.hashForSlug(record.slug)) history.replaceState(null,'',D.hashForSlug(record.slug));
    dialog.scrollTop=0;
    void hydrateSourceLinks(record,root);
  }
  function closeDialog() {
    const dialog = $('#lore-dialog');
    if (dialog.open) dialog.close();
  }
  function openFromHash() {
    const slug = D.slugFromHash(location.hash);
    if (!slug) { if ($('#lore-dialog').open) closeDialog(); return; }
    if (!state.ready) return;
    const found=state.records.find(r=>r.slug===slug);
    if(found && state.openedSlug!==slug) show(found,null);
  }
  function initHandlers() {
    $('#search-input').addEventListener('input',e=>{state.query=e.target.value;renderCards();});
    $('#sort-select').addEventListener('change',e=>{state.sort=e.target.value;renderCards();});
    $('#clear-search').addEventListener('click',()=>{state.query='';state.category='all';$('#search-input').value='';renderChips();renderCards();$('#search-input').focus();});
    $('#random-theory').addEventListener('click',()=>{if(!state.records.length)return;const r=state.records[Math.floor(Math.random()*state.records.length)];show(r,$('#random-theory'));});
    $('#close-dialog').addEventListener('click',closeDialog);
    $('#lore-dialog').addEventListener('close',()=>{
      document.body.classList.remove('dialog-open');state.openedSlug=null;
      if (D.slugFromHash(location.hash)) history.replaceState(null,'','#library');
      if (state.lastTrigger && state.lastTrigger.isConnected) state.lastTrigger.focus();
    });
    document.addEventListener('keydown',e=>{
      const tag=document.activeElement && document.activeElement.tagName;
      if(e.key==='/' && !$('#lore-dialog').open && !['INPUT','TEXTAREA','SELECT'].includes(tag)){
        e.preventDefault();$('#search-input').focus();document.querySelector('#library').scrollIntoView({block:'start'});
      }
    });
    window.addEventListener('hashchange',openFromHash);
  }
  async function init() {
    initHandlers();
    try {
      const response=await fetch('../dist/theories.jsonl',{cache:'no-cache'});
      if(!response.ok) throw new Error('Archive request returned HTTP ' + response.status);
      const all=D.parseJsonl(await response.text());
      if(!all.length) throw new Error('Archive contains no theories');
      state.records=all;state.ready=true;
      $('#stat-theories').textContent=all.length;
      $('#stat-categories').textContent=Object.keys(D.categoryCounts(all)).length;
      renderChips();renderCards();openFromHash();
    } catch(error) {
      const msg=$('#library-message');
      msg.hidden=false;
      msg.textContent='The pond is quiet: could not load the archive. Run a local server from the repository root (python3 -m http.server 4173) and open /explorer/. Details: '+error.message;
      $('#shown-count').textContent='0';
    }
  }
  document.addEventListener('DOMContentLoaded',init);
})();
