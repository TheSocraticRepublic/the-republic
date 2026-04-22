# The Republic — Briefing View Design Specification

**Version:** 1.0
**Date:** 2026-03-30
**Author:** Jen (Creative Director)
**Status:** Phase 0 implementation contract

---

## Design Vision

The briefing is a civic document, not a dashboard widget. It should read with the gravity and clarity of a well-designed policy brief — dark app chrome frames it, light paper surface holds it, and the five arms provide the only color. Every design decision serves one outcome: a citizen who skimmed the first screen knows what was found and what they can do. A citizen who read everything trusts what they read.

---

## Conflict Resolutions

Seven research findings challenged the original review. Each is resolved here with a verdict and rationale.

### 1. Content Island — RESEARCH IS RIGHT, ORIGINAL POSITION REVISED

**Verdict:** The entire briefing content area moves to a light surface.

**Reasoning:** The original review proposed keeping the briefing on the dark background and stripping the glass cards from prose sections. The research is correct that this is insufficient. The NN/g evidence is definitive: light mode produces superior visual acuity for reading tasks, and the smaller the body text, the more critical this becomes. The briefing is the primary reading artifact in the entire product. Treating it like the navigation chrome is a category error.

The content island pattern — dark chrome, light document surface — is established practice across PDF viewers, code editors, and reading applications precisely because it solves this problem. The dark background stays as the ambient environment. The document itself is on paper.

**What changes:** All briefing sections move from `bg-black/50 backdrop-blur-md` to a single light container. The glass card treatment is retired for prose.

---

### 2. Executive Summary — ADD IT

**Verdict:** Add a one-screen executive card as the first element of every briefing.

**Reasoning:** The original review did not propose this. It should have. The Brookings/RAND model front-loads summary and recommendations because busy decision-makers — and busy citizens — read the first page. If the briefing works at one screen, everything below is elective depth. This is also consistent with the Stanford finding that users ask only 1.6 prompts on average: they are not going to scroll five sections if they don't immediately understand why it matters.

**What ships in Phase 0:** A static executive card rendered from the existing parsed sections — the concern restated, key findings extracted from section headings, available actions shown as buttons. This requires no new backend work; the parser already has the data. The card is the entry point, not an extra screen.

---

### 3. Collapsible Cards vs. Strip Cards — SPLIT DECISION

**Verdict:** Strip glass cards from prose sections (original review stands). Collapsible behavior is deferred to Phase 1.

**Reasoning:** The Markup's Blacklight collapsible pattern is correct for the long-term architecture. Headings that are conclusions, not labels, is excellent information design. However, Phase 0 cannot support this without rethinking the section parser and the LLM prompt structure simultaneously. The heading content from the current LLM output is section labels ("What Governs This"), not conclusions ("The city has no binding noise bylaw for construction on weekends"). Collapsible cards built on label-headings are collapsible but not scannable — the interaction exists but delivers no benefit until the headings carry conclusions.

**Decision:** Strip the glass cards now (typography and readability win), architect the section structure to accept conclusion-headings later. The `parseSections()` function and section detection logic in `briefing-view.tsx` remain unchanged for Phase 0.

---

### 4. Inline Actions at Decision Points — ADOPT PARTIALLY

**Verdict:** Inline contextual actions after the Oracle analysis and after the FIPPA letter. The bottom "Go Deeper" strip stays but is secondary.

**Reasoning:** The research is right that "File an FOI about this" is more powerful after the finding that revealed the gap, not at the bottom of the page after the citizen has lost momentum. However, full Coda/Notion-style embedded actions across every section requires the LLM to produce structured output that tags action opportunities — that is Phase 1 work.

**What ships in Phase 0:** Two hardcoded inline action points added to the existing section renderers:
- After the Oracle analysis section: a compact "Explore this with the Gadfly" button
- After the FIPPA letter card: the existing Copy/Download buttons (already implemented correctly)

The Go Deeper grid stays as a discovery tool, not the primary action surface.

---

### 5. Two-Column FIPPA Split — DEFERRED

**Verdict:** Single-column light card in Phase 0. Two-column layout deferred to Phase 1.

**Reasoning:** The Stripe docs two-column split (explanation left, letter text right) is the right eventual model for the Lever's output. It correctly separates comprehension from artifact. However, it requires the LLM to produce section-annotated letter output with corresponding plain-language explanations for each clause — structured paired content the current prompt does not generate.

The existing `FippaLetterCard` component already has Copy and Download. In Phase 0, the letter moves to the light surface, the monospace font is replaced with Inter, and a brief plain-language preamble is added above the letter (one paragraph, hardcoded: "This is a formal request under the Freedom of Information and Protection of Privacy Act. You can copy and send this directly to the public body named above."). The two-column split ships when the backend can produce paired content.

---

### 6. Power Map as Interactive Quadrant — DEFERRED

**Verdict:** Not in Phase 0.

**Reasoning:** The interactive 2x2 quadrant is the right long-term format for power analysis output. It is also a distinct frontend component with its own data schema, entity model, and interaction states. The current briefing has no power map section at all — the Oracle produces prose analysis. Adding a quadrant visualization before the underlying data structure exists creates a component with no content. Architect the data model (entity, power score, alignment score, metadata) in Phase 1 alongside the LLM prompt changes. Design the component then.

---

### 7. "What This Analysis Cannot See" — ADD IT

**Verdict:** Add as a required final section in Phase 0, before the Go Deeper strip.

**Reasoning:** The Stanford finding is the most dangerous one in the research: beginners cannot distinguish comprehensive answers from partial ones. The Republic's credibility depends entirely on not breeding false confidence. A disclaimer footer is not enough — the research confirms warning labels are ignored. A named, visible section positioned as a peer to the substantive analysis communicates that limitations are not an afterthought but a structural feature of honest analysis.

**What ships in Phase 0:** A new section renderer for headings containing "cannot see" or "limitations." Styled distinctly — slightly more subdued than the analysis sections, no arm color accent, a muted border. The LLM prompt must be updated to include this section in every briefing output.

---

## Layout Architecture

### Overall Structure

```
Dark chrome: bg-[#090909]
  └── Briefing page: px-4 py-6 (mobile) / px-6 py-8 (desktop)
        └── Content island: max-w-2xl mx-auto
              ├── Executive Card (always first)
              ├── Section: Your Concern
              ├── Section: What Governs This
              ├── Section: What the Public Record Shows
              │     └── Inline action: "Explore with Gadfly"
              ├── Section: What You Can Do (FIPPA letter)
              ├── Section: How Other Places Handle This
              ├── Section: Questions Worth Asking
              ├── Section: What This Analysis Cannot See
              └── Go Deeper (discovery strip)
```

### Content Island

The content island is a single `<article>` element. It does not have a card border — it is the page itself within the dark surround.

```
article.content-island
  background: #fafaf9           // stone-50, warm paper
  color: #1c1917                // stone-900
  max-width: 672px
  margin: 0 auto
  padding: 40px 40px            // desktop
  padding: 32px 20px            // mobile (<768px)
  border-radius: 16px
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4), 0 20px 60px -10px rgba(0,0,0,0.6)
```

Sections within the island are separated by horizontal rules, not card borders.

```
section divider:
  border-top: 1px solid #e7e5e4    // stone-200
  margin: 32px 0
```

### Reading Column

Body text is constrained to 65ch within the island. Supporting elements (document field cards, FIPPA letter, questions list) may use full island width.

---

## Typography

All values are for the content island (light surface). Chrome typography is unchanged.

| Role | Font | Size | Weight | Color | Line Height |
|---|---|---|---|---|---|
| Briefing title | Plus Jakarta Sans | 22px | 700 | #1c1917 | 1.3 |
| Concern restatement | Inter | 16px | 400 | #44403c | 1.6 |
| Section label | Inter | 11px | 600 | #78716c | 1 |
| Section label (action) | Inter | 11px | 700 | arm color | 1 |
| Body text | Inter | 16px | 400 | #292524 | 1.7 |
| Bullet items | Inter | 15px | 400 | #44403c | 1.6 |
| Field label | Inter | 11px | 600 | #78716c | 1 |
| Field value | Inter | 14px | 400 | #44403c | 1.5 |
| FIPPA letter body | Inter | 14px | 400 | #292524 | 1.65 |
| Metadata / captions | Inter | 12px | 400 | #78716c | 1.4 |
| Questions | Inter | 15px | 500 | #1c1917 | 1.55 |
| Limitations text | Inter | 15px | 400 | #57534e | 1.6 |

**No monospace for FIPPA letter.** The current implementation uses `SF Mono` for the letter body. Replace with Inter 14px. Monospace signals code, not correspondence. The letter is a formal document, not a shell command.

**Section labels** are 11px uppercase tracked at `0.1em`, not "decorative" — they orient the citizen within the document structure. Action sections (What You Can Do) use their arm color (Lever red `#C85B5B`) at label level only.

---

## Color and Surface Treatment

### Design Tokens (additions to globals.css)

```css
/* Content island — add to @theme block */
--color-island-bg: #fafaf9;
--color-island-text: #1c1917;
--color-island-secondary: #44403c;
--color-island-muted: #78716c;
--color-island-border: #e7e5e4;
--color-island-card: #f5f4f3;
--color-island-card-border: #e0ddd9;
```

### Surface Hierarchy Within the Island

| Layer | Background | Border | Use |
|---|---|---|---|
| Island | #fafaf9 | none | Outer container |
| Document card | #f5f4f3 | 1px #e0ddd9 | "What Governs This" items |
| FIPPA letter | #ffffff | 1px #e7e5e4 with Lever accent top | Letter body |
| Concern restatement | rgba(176,136,200,0.06) | 1px rgba(176,136,200,0.18) | Scout tint, light |
| Limitations | rgba(120,113,108,0.05) | 1px #e0ddd9 | Muted, no arm color |

### Arm Colors on Light Surface

The arm accent colors in globals.css work on dark backgrounds. On the light island, use them at reduced opacity for backgrounds and at full saturation only for text and icons.

| Arm | Text / Icon | Background tint | Border |
|---|---|---|---|
| Scout | #B088C8 | rgba(176,136,200,0.06) | rgba(176,136,200,0.18) |
| Oracle | #89B4C8 | rgba(137,180,200,0.06) | rgba(137,180,200,0.18) |
| Gadfly | #C8A84B | rgba(200,168,75,0.06) | rgba(200,168,75,0.18) |
| Lever | #C85B5B | rgba(200,91,91,0.06) | rgba(200,91,91,0.18) |
| Mirror | #5BC88A | rgba(91,200,138,0.06) | rgba(91,200,138,0.18) |

The FIPPA letter card header uses `rgba(200,91,91,0.08)` background with a 2px Lever-red top border (not full border) to signal action without overwhelming the document.

### Dark Mode Toggle

The light surface is Phase 0 default. A dark reading mode toggle (inverting the island to `--color-surface-2: #18181b` with `--color-foreground: #f4f4f5` text) is a Phase 1 feature. Do not implement the toggle now; do not hardcode anything that would break it later. The island tokens must be separate from the chrome tokens, which they already are in this spec.

---

## Component Specifications

### Executive Card

Rendered first, before any parsed section. Constructed from the parsed sections array — concern text from the Scout section, section headings as finding summaries, available actions detected from section types present.

```
.executive-card
  margin-bottom: 40px
  padding-bottom: 32px
  border-bottom: 2px solid #e7e5e4

  .concern-label
    font: 11px/1 Inter 600 uppercase tracking-[0.1em]
    color: #78716c
    margin-bottom: 8px

  .concern-text
    font: 16px/1.6 Inter 400
    color: #44403c
    max-width: 60ch

  .findings-label
    font: 11px/1 Inter 600 uppercase tracking-[0.1em]
    color: #78716c
    margin: 24px 0 12px

  .findings-list
    list-style: none
    space-y: 8px

    .finding-item
      display: flex
      align-items: flex-start
      gap: 10px
      font: 14px/1.5 Inter 400
      color: #292524

      .finding-dot
        width: 6px, height: 6px
        border-radius: 50%
        background: #C85B5B   // Lever red — these are actionable insights
        flex-shrink: 0
        margin-top: 6px

  .actions-row
    display: flex
    gap: 8px
    flex-wrap: wrap
    margin-top: 20px

    .action-chip
      padding: 6px 14px
      border-radius: 20px
      font: 12px/1 Inter 600
      border: 1px solid [arm border]
      background: [arm tint]
      color: [arm color]
      cursor: pointer
```

The executive card is not collapsible and cannot be minimized. It is always visible.

---

### Section Container (all sections)

Replaces the current `rounded-xl border border-white/[0.08] bg-black/50 backdrop-blur-md` wrapper.

```
.section
  margin-bottom: 0   // sections separated by dividers, not margin

  .section-header
    display: flex
    align-items: center
    gap: 8px
    margin-bottom: 16px

    .section-label
      font: 11px/1 Inter 600 uppercase tracking-[0.1em]
      color: #78716c      // default
      color: [arm color]  // for action sections (Lever)

    // NO arm badge. Remove ArmBadge component from SectionHeader.

  .section-body
    // no background, no border, no blur
    // text sits directly on island surface
```

**Remove:** The `ArmBadge` component and all calls to `getArmBadge()`. The section label carries the arm identity through color. A badge next to a label saying the same thing is redundant.

---

### Document Cards (What Governs This)

Retain the card treatment here — document metadata benefits from visual grouping. Move surface to light tokens.

```
.document-card
  background: #f5f4f3
  border: 1px solid #e0ddd9
  border-radius: 12px
  padding: 20px

  .doc-name
    font: 14px/1.4 Plus Jakarta Sans 600
    color: #1c1917

  .field-label
    font: 10px/1 Inter 600 uppercase tracking-[0.08em]
    color: #78716c
    margin-bottom: 4px

  .field-value
    font: 14px/1.5 Inter 400
    color: #44403c

  .how-to-find (footer)
    border-top: 1px solid #e7e5e4
    padding-top: 12px
    margin-top: 16px

    .label
      font: 10px/1 Inter 600 uppercase tracking-[0.08em]
      color: #a8a29e

    .value
      font: 12px/1.5 Inter 400
      color: #78716c
```

AccessBadge colors remain the same arm colors but use the light-surface tint/border values from the arm color table above.

---

### FIPPA Letter Card

```
.fippa-letter-card
  background: #ffffff
  border: 1px solid #e7e5e4
  border-top: 2px solid #C85B5B   // Lever red top accent
  border-radius: 12px
  overflow: hidden

  .fippa-header
    background: rgba(200,91,91,0.05)
    border-bottom: 1px solid rgba(200,91,91,0.12)
    padding: 12px 20px
    display: flex
    align-items: center
    justify-content: space-between

    .fippa-label
      font: 11px/1 Inter 700 uppercase tracking-[0.1em]
      color: #C85B5B

    .button-row
      display: flex
      gap: 8px

      button
        padding: 5px 10px
        border-radius: 6px
        font: 11px/1 Inter 500
        background: rgba(200,91,91,0.06)
        border: 1px solid rgba(200,91,91,0.15)
        color: #78716c
        hover: color: #292524, border-color: rgba(200,91,91,0.3)

  .fippa-preamble
    // NEW: brief plain-language explanation above letter
    padding: 16px 20px 0
    font: 13px/1.6 Inter 400
    color: #78716c
    border-bottom: 1px dashed #e7e5e4
    padding-bottom: 16px

  .fippa-body
    padding: 20px
    font: 14px/1.65 Inter 400    // NOT monospace
    color: #292524
    white-space: pre-wrap
```

Copied state: button background `rgba(91,200,138,0.10)`, color `#5BC88A`, border `rgba(91,200,138,0.25)`.

---

### Questions Section (Gadfly)

Question numbers retain the Gadfly gold — this is correct and should stay. Move background to light tokens.

```
.question-item
  display: flex
  align-items: flex-start
  gap: 16px

  .question-number
    width: 24px, height: 24px
    border-radius: 50%
    background: rgba(200,168,75,0.10)
    border: 1px solid rgba(200,168,75,0.25)
    color: #C8A84B
    font: 11px/1 Inter 700
    flex-shrink: 0
    display: flex align-items: center justify-content: center

  .question-text
    font: 15px/1.55 Inter 500
    color: #1c1917
```

---

### Inline Gadfly Action (after Oracle section)

New element. Rendered after the "What the Public Record Shows" section closes.

```
.inline-action
  margin-top: 20px
  padding-top: 20px
  border-top: 1px solid #e7e5e4
  display: flex
  align-items: center
  justify-content: space-between

  .action-prompt
    font: 13px/1 Inter 400
    color: #78716c

  .action-button
    display: inline-flex
    align-items: center
    gap: 6px
    padding: 7px 14px
    border-radius: 8px
    font: 12px/1 Inter 600
    background: rgba(200,168,75,0.08)
    border: 1px solid rgba(200,168,75,0.20)
    color: #C8A84B
    transition: background 150ms ease, border-color 150ms ease
    hover: background: rgba(200,168,75,0.14), border-color: rgba(200,168,75,0.32)
```

Label: "Have more questions about this?" / Button: "Explore with Gadfly" / Icon: MessageCircleQuestion 12px

---

### Limitations Section (What This Analysis Cannot See)

New section renderer. Activated by heading containing "cannot see" or "limitations."

```
.limitations-section
  background: rgba(120,113,108,0.04)
  border: 1px solid #e0ddd9
  border-left: 3px solid #a8a29e    // muted stone accent, no arm color
  border-radius: 0 8px 8px 0
  padding: 16px 20px

  .limitations-label
    font: 10px/1 Inter 600 uppercase tracking-[0.1em]
    color: #a8a29e
    margin-bottom: 10px

  .limitations-body
    font: 15px/1.6 Inter 400
    color: #57534e
```

The left-border treatment (not card border) signals "annotation" rather than "section." It reads as a structural note, not a disclaimer.

---

### Go Deeper Strip

Keep the component. Move surface to light island tokens.

```
.go-deeper
  margin-top: 40px
  padding-top: 32px
  border-top: 1px solid #e7e5e4

  .go-deeper-label
    font: 11px/1 Inter 600 uppercase tracking-[0.1em]
    color: #a8a29e
    margin-bottom: 16px

  .link-grid
    display: grid
    grid-template-columns: 1fr 1fr    // 2 col on mobile
    grid-template-columns: 1fr 1fr 1fr  // 3 col on desktop (≥768px)
    gap: 8px

    .link-card
      background: [arm tint, light values]
      border: 1px solid [arm border, light values]
      border-radius: 10px
      padding: 12px 14px
      hover: opacity 0.85
      transition: opacity 150ms

      .arm-name
        font: 11px/1.2 Inter 600
        color: [arm color]
        margin-bottom: 3px

      .arm-description
        font: 11px/1.4 Inter 400
        color: #78716c
```

---

## Mobile Considerations

Breakpoint: 768px.

| Element | Mobile (<768px) | Desktop (≥768px) |
|---|---|---|
| Island padding | 32px 20px | 40px 40px |
| Island border-radius | 12px | 16px |
| Island max-width | 100% (no margin) | 672px centered |
| Executive card actions | flex-wrap, full-width chips | flex-row, auto-width |
| Document card grid | single column | single column (already) |
| Go Deeper grid | 2 columns | 3 columns |
| Section label font | 10px | 11px |
| Body font | 16px (unchanged) | 16px |
| FIPPA header buttons | stacked or icon-only | inline row |

The island at mobile breakpoint removes the side margin and border-radius reduction makes it feel native. Do not reduce the body font below 16px on any breakpoint. This is the readability floor.

**FIPPA button row on mobile:** The current implementation already has this partially broken (two buttons in a row within a constrained header). Fix: on mobile, the Download button shows icon only (`<Download size={11} />`, no label), Copy button retains label. Gap collapses to 6px.

---

## Motion

```
Island entrance (briefing load):
  opacity: 0 → 1
  transform: translateY(8px) → translateY(0)
  duration: 300ms
  easing: ease-out
  delay: 0ms

Section reveal during streaming:
  No animation. Text appears as-streamed. Animation on streamed content creates jitter.

Inline action button hover:
  background, border-color
  duration: 150ms
  easing: ease

Copied state transition:
  color, background, border-color
  duration: 150ms
  easing: ease
  reverse: 2000ms delay then 150ms back

Go Deeper link hover:
  opacity: 1 → 0.85
  duration: 150ms
  easing: ease
```

All animations must respect `prefers-reduced-motion`. When this media query matches, remove all transform and opacity transitions. Retain instant state changes (hover colors, copied feedback).

```css
@media (prefers-reduced-motion: reduce) {
  .content-island,
  .action-button,
  .link-card {
    transition: none;
    animation: none;
  }
}
```

---

## Accessibility

- **Focus ring:** Inherit existing `*:focus-visible` rule. On the light island, the Oracle-blue outline (`rgba(137,180,200,0.6)`) has sufficient contrast. Verify against #fafaf9 — if contrast drops below 3:1, increase opacity to 0.85 or use `#5A9AB5`.
- **Section labels as headings:** The section label `<h3>` in `SectionHeader` is correct. The briefing title should be `<h2>`. Executive card concern text should be `<p>`, not a heading.
- **FIPPA letter:** The `<pre>` element must have `role="region"` and `aria-label="FIPPA Request Letter"`. Copy and Download buttons need descriptive `aria-label` attributes ("Copy FIPPA letter to clipboard", "Download FIPPA letter as text file").
- **Limitations section:** Must include `role="note"` on the container.
- **Question list:** `<ol>` with `aria-label="Questions worth asking"`. Number badges are `aria-hidden="true"` — the list item order communicates the numbering semantically.
- **Action buttons/chips:** Every interactive element needs a minimum 44x44px touch target on mobile. Chip padding must produce at least 36px height on mobile; add `min-height: 36px` to action chips and increase to `min-height: 44px` for Go Deeper link cards.

---

## What to Defer

These patterns are architecturally correct but require backend changes or distinct component work that exceeds Phase 0 scope.

| Pattern | Why Deferred | When to Revisit |
|---|---|---|
| Collapsible cards with conclusion-headings | Requires LLM prompt to produce conclusion-headings, not section labels | Phase 1: prompt engineering + section parser rewrite |
| Two-column FIPPA split (Stripe docs) | Requires LLM to produce paired explanation/letter-clause content | Phase 1: Lever prompt redesign |
| Power map interactive quadrant | No power map data or section yet; needs entity schema first | Phase 1: Oracle output schema |
| Dark reading mode toggle | Correct UX, not urgent in Phase 0 | Phase 1: token system already supports it |
| Similar requests deduplication | Requires a request archive and similarity search | Phase 2: after filing pipeline exists |
| Jurisdiction comparison card grid | Currently prose; needs structured Mirror output | Phase 1: Mirror output schema |
| Source deep-dive (Level 2 disclosure) | Requires linked document viewer | Phase 2: Scout integration |

---

## Implementation Notes for Ted

**Files to modify:**

1. `/home/leesalo/Projects/the-republic/src/app/globals.css` — add island color tokens to `@theme` block
2. `/home/leesalo/Projects/the-republic/src/components/briefing/briefing-view.tsx` — primary implementation target

**Sequence:**

1. Add CSS tokens first (non-breaking)
2. Wrap all existing section renderers in a single `<article>` island container — the surface change is structural and touches every section
3. Remove `ArmBadge` component and all `getArmBadge()` calls; update section labels with arm-color for action sections
4. Update `ProseSection` text colors from `text-neutral-300` to island tokens
5. Update `DocumentCard` from dark glass to light card surface
6. Update `FippaLetterCard`: remove monospace, add preamble paragraph, apply light surface
7. Update `QuestionsSection`: text colors to island tokens
8. Add `ExecutiveCard` component (new, constructed from `ParsedSection[]`)
9. Add inline Gadfly action after Oracle section renderer
10. Add `LimitationsSection` component and renderer detection
11. Update `GoDeeper` surface tokens
12. Add motion/accessibility passes last

**Do not change:** The section parser (`parseSections()`), the document block splitter (`splitDocumentBlocks()`), the `extractFippaLetter()` function, or the Copy/Download logic. These are functional, not visual.
