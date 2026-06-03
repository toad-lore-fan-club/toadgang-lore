# Contributing to Toadgang Lore

Welcome. If you've found your way here, you already know what Toadgang is. If you don't, start in `#what-is-happening` on the Discord.

This repo is the canonical lore archive. Every theory lives as a Markdown file, readable by humans and agents alike. Submissions go through a PR — no exceptions, no Discord-only lore.

---

## Before you submit

- **One theory per file.** Don't bundle.
- **Source everything.** A theory without a community source link will be rejected.
- **Be honest about confidence.** 0.72 is more trustworthy than 0.98. Rate yourself.
- **Read related theories first.** Check the index — yours may already exist or contradict something.

---

## How to submit

1. Fork this repo.
2. Copy the template below into the right folder under `theories/`.
3. Name the file `your-slug-here.md`.
4. Fill in every field. Don't skip sections.
5. Open a PR. CI will validate your frontmatter automatically.
6. If CI passes, a maintainer will review the prose. Expect feedback.

---

## Folder structure

```
theories/
├── origin/       creation myths, how Toadgang began
├── toadgod/      theories about the Toadgod specifically
├── prophecy/     predictions, cycles, upcoming events
├── ritual/       community behaviors with lore significance
├── geography/    places (physical or digital) in the lore
├── faction/      groups, alliances, rivalries
└── artifact/     objects, symbols, recurring images
```

Put your file in the folder that matches your theory's `category` field.

---

## Theory template

Copy this exactly. Replace everything in `<angle brackets>`. Delete nothing else.

```markdown
---
slug: <your-slug-here>
title: <Human Readable Title>
category: <origin|toadgod|prophecy|ritual|geography|faction|artifact>
confidence: <0.0 to 1.0>
safety: <speculative · not confirmed|community consensus · unverified|toadgod hinted · interpret with care|confirmed canon>
community_source: "<URL or citation>"
toadgod_signal: "<Direct quote, post link, or signal — omit field if none>"
tags: ["<tag1>", "<tag2>"]
related_theories: ["<other-slug>"]
last_updated: <YYYY-MM-DD>
contributors: ["<your-handle>"]
---

> ⚠️ **<your safety label>** — <One sentence stating what this label means for this theory.>

---

## Core theory

<What is the theory? Write it plainly. Assume the reader knows Toadgang but has never heard this theory. 2–4 paragraphs.>

---

## Community source

<Where did this theory come from? Link the original thread, post, or discussion. Who first articulated it? How did it develop?>

---

## Toadgod evidence

<What has the Toadgod actually said, posted, or done that relates to this theory? Quote directly where possible. If there is no Toadgod signal, say so explicitly rather than omitting this section.>

---

## Why it may be close

<Make the best honest case for this theory. What evidence supports it? What would have to be true for it to be correct?>

---

## Why it may be far off

<Make the honest case against. What could explain the evidence without the theory? Where is the logic weakest?>

---

## Confidence rationale

<Explain your score in 2–3 sentences. What would move the score up? What would move it down?>
```

---

## Confidence score guide

| Score | Meaning |
|-------|---------|
| 0.0 – 0.2 | Pure speculation. Pattern-matching on vibes. |
| 0.2 – 0.4 | Some community discussion. Weak evidence. |
| 0.4 – 0.6 | Reasonable theory. Evidence is real but ambiguous. |
| 0.6 – 0.8 | Strong case. Multiple independent signals. |
| 0.8 – 0.95 | Near consensus. Very hard to explain otherwise. |
| 0.95 – 1.0 | Confirmed. Reserved for things the Toadgod has explicitly stated. |

If you're tempted to give something a 0.97 because you really believe it, make it a 0.82. The repo's credibility depends on honest scoring.

---

## Safety labels

| Label | When to use |
|-------|------------|
| `speculative · not confirmed` | Default. Community-originated, no Toadgod signal. |
| `community consensus · unverified` | Widely held but still unconfirmed. |
| `toadgod hinted · interpret with care` | Toadgod has produced adjacent signal. Not confirmation. |
| `confirmed canon` | Toadgod has explicitly stated this. Rare. |

---

## What gets rejected

- No source link.
- Confidence score that doesn't match the evidence in the file.
- Missing sections (all six prose sections are required).
- Slug that conflicts with an existing theory.
- Theories that are really just fan fiction with no lore grounding.

---

## Questions

Ask in `#lore-submissions` on the Discord before opening a PR if you're unsure. We'd rather help you shape a good theory than reject a bad submission.
