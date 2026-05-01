# PDF Template Design Research

Compiled 2026-04-29 from industry best practices research across civic/legal documents, advocacy materials, and data presentation formats.

## Cross-Cutting Principles

- **Print-first = light mode.** White/off-white background (#fafaf9), dark text (#1c1917). Accent colors at reduced saturation.
- **Tufte's data-ink ratio.** Every visual element must encode information. Remove anything decorative.
- **1-2 dominant colors, max 3 accents.** Lever red (#C85B5B) as primary accent. Mirror green (#5BC88A) for comparison subject. Oracle blue (#89B4C8) and Gadfly amber (#C8A84B) available for status coding.
- **Source traceability is non-negotiable.** Cell/event-level citations, not just document-level.
- **The "far view" test.** Can a reader extract the main finding in 5 seconds?

## Font Strategy

| Document Type | Display Font | Body Font | Rationale |
|---|---|---|---|
| FOI Request | Source Serif 4 Bold | Source Serif 4 Regular, 12pt | Legal correspondence convention demands serif |
| Public Comment | Plus Jakarta Sans | Inter 11pt | Formal submission but not court filing |
| Policy Brief | Plus Jakarta Sans | Inter 10-11pt | Think tank norm is modern sans-serif |
| Fact Sheet | Plus Jakarta Sans Bold | Inter 10-11pt | Advocacy standard |
| Talking Points | Plus Jakarta Sans Bold | Inter 11-12pt | Must be glanceable at arm's length |
| Timeline | Plus Jakarta Sans | Inter 10-11pt | Data presentation |
| Comparison | Plus Jakarta Sans | Inter 10pt | Dense tabular data |

---

## 1. FOI Request Letter

**Layout:** Full block style (flush left). Sender address → Date → Addressee → Reference line → Salutation → Body → Closing → Signature.

**Key elements:**
- Serif body text, 12pt, single-spaced within paragraphs, double between
- 1-inch margins all sides
- Reference line in bold: "Re: Freedom of Information Request pursuant to [Act, citation]"
- Body sections: statutory basis → numbered records requested → format preference → fee waiver request → timeline reminder → right of review
- Signature line (200px rule) with [YOUR NAME] and [YOUR ADDRESS] placeholders
- Minimal decoration — no color except subtle header rule
- No logos (citizen requests should not look like form letters)

**Effectiveness:** Specificity wins. Cite the statute early. Number each record requested. Include date ranges. Polite but firm tone.

## 2. Public Comment

**Layout:** Header block (docket/reference ID prominent) → Subject line → Opening → Numbered paragraphs → Recommendations box → Closing → Signature.

**Key elements:**
- Docket/reference number prominently displayed — comments without this get lost
- Sequential paragraph numbering (1, 2, 3...) — the single most important convention
- Section headers tied to regulatory provision numbers being addressed
- Visually distinct recommendations section (border, slight background tint)
- 11-12pt body, 1-inch margins
- Header/footer: submitter name + docket ID on every page

**Effectiveness:** One good comment beats 1,000 form letters. Section-by-section structure matching the proposed rule. Specific recommendations ("Section 4.2(b) should be amended to read...").

## 3. Policy Brief

**Layout:** Header (wordmark + title + author) → Executive Summary box → Background → Analysis/Key Findings → Recommendations box → Implementation → References.

**Key elements:**
- 2-8 pages (4 is the sweet spot). 2,000-2,500 words.
- Executive summary on page 1 is non-negotiable — contains problem, key finding, recommendation
- Sidebar callout boxes (20-25% of page width, tinted accent background) for key stats, definitions, case examples
- Data highlight boxes: large number (24-36pt bold) + caption below
- Recommendation box: bordered, tinted, bold "RECOMMENDATIONS" header, numbered items
- Pull quotes: 14-16pt, accent color, thin left border
- Plus Jakarta Sans + Inter works perfectly here

**Effectiveness:** Visual hierarchy does the work. A reader scanning headers, sidebars, and recommendations in 30 seconds should get 80% of the argument. Non-academic language.

## 4. Fact Sheet

**Layout:** One page, non-negotiable. Accent band → Headline → Lead stat callout → Issue summary → Numbered findings → Supporting visual → Action items → Sources.

**Key elements:**
- Headline is a conclusion, not a topic: "City Approved 14 Variances Without Public Notice" not "Variance Process Overview"
- Lead stat: 28-36pt number in accent color with 14pt descriptor
- Numbered findings (not bullets) — numbered items are more citable ("Finding #3 says...")
- One chart/table maximum — it must earn its space
- Callout box: tinted background (5-10% opacity), 3px left border in accent color
- 10-11pt body, never below 9pt. Two fonts maximum.
- Top accent band: 3-5px colored strip

**Effectiveness:** Front-loaded key findings. One page forces clarity. Verifiable claims with visible sourcing. The lead stat should be screenshot-worthy / quotable.

## 5. Talking Points

**Layout:** Two variants:

**A. Briefing Note (decision-support):** Issue → Background → Current Status → Key Considerations → Anticipated Q&A → Recommendation.

**B. Organizer Format (the one we use):** Header strip (meeting, date, decision-maker, the ask) → Your Ask (bold, at top) → 3 numbered talking points (claim + evidence) → Anticipated Pushback + Responses → What NOT to Say → Closing statement.

**Key elements:**
- Two-column option: left for talking points, right (narrower, shaded) for pushback/responses — the killer feature
- Bold talking points at 11-12pt are self-contained sentences readable at arm's length
- Pushback visually distinct: italic, tinted background, different color border
- Maximum 3-4 points. More than that, speakers can't remember them.
- Leave margin space for handwritten notes — this is a working tool, not a finished product
- 1-2 pages maximum

**Effectiveness:** The ask at the top, not the bottom. Claim-evidence-pushback-response as a complete argumentative unit. Designed to be glanced at, not read.

## 6. Timeline

**Layout:** Portrait. Left-aligned vertical spine. Title block → Legend → Chronological events → Sources.

**Key elements:**
- Spine: single vertical line, left-aligned (wide right column for descriptions)
- Event nodes: 8-10px circles. Solid fill for critical deadlines, hollow for historical events
- Non-proportional time axis (proportional creates huge gaps for quiet periods)
- Phase/year dividers: all-caps, 9pt, letterspaced, muted
- Actor/entity tags: small chips, color-coded by entity type
- Connector lines: horizontal, 1px. Dashed for approximate dates
- Critical deadlines: red/amber node, heavier connector, "DEADLINE" chip
- Mixed granularity: italic or lighter weight for approximate dates ("~Q2 2024")

**Effectiveness:** ProPublica "near/far" principle — color conveys category at a glance, text provides depth. Narrative momentum from vertical read direction. Actor visibility for institutional accountability.

## 7. Comparison Table

**Layout:** Jurisdictions as columns (not rows). Row-header column → Subject jurisdiction column → 2-4 comparison columns. Below table: "Argument from Existence" synthesis block.

**Key elements:**
- Subject jurisdiction: first data column, faint accent background (Mirror green at 5-8% opacity), 2px left border in accent color
- Zebra striping: subtle alternating row backgrounds (5-10% opacity difference)
- Row groups clustered under sub-headers ("Legal Framework," "Implementation," "Outcomes")
- Cell borders: thin (0.5-1px) horizontal rules. Vertical dividers only between jurisdiction columns
- Outcome indicators: small inline badges (green check / amber dash / red x)
- Source citations: superscript numbers, footnote block at table bottom
- "Argument from Existence" block: accent-tinted panel below table, synthesis of what the comparison proves

**Effectiveness:** A reader should answer "who does this best?" in 3 seconds by scanning one row. Consistent metrics across columns. Honest gaps ("No data") over omissions.
