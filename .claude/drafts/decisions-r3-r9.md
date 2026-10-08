# Republic: proposed DECISIONS.md entries (R3-R9 + one evidence correction)

*Drafted 2026-10-07 by session marvin/republic-r2. Nothing is written until Lee says yes.*

## The decision

**Should these eight entries go into the Republic's permanent rulings file, worded as below?**

- **What exists today.** On 2026-10-02 you made seven rulings during the UI review: links, warm surfaces, plain filings, wordmark, privacy address, grain, and the gated Forum. They live only inside the remediation plan. The project's rulings file has nothing newer than 2026-08-21.
- **Where it lands.** `.claude/DECISIONS.md` in the public Republic repo. Every future session reads this file before proposing anything. Nothing on the live site changes.
- **The tension.** The plan is about to execute all twenty batches. A ruling that exists only in a plan expires with that plan, and a later session could undo, for example, the white no-branding filing without knowing you decided it. Because the file is append-and-amend, the wording is near-permanent, so it needs your eye once.
- **Options.**
  - (a) Approve as written. One yes, and all eight go in through the writer.
  - (b) Approve with edits. Say which number to change; the others go in.
  - (c) Hold all of them until the relay closes, which is when the plan said to propose them. Cost: until then, the rulings exist only in the plan.
- **Recommendation: (a).** Several batches (A1, A2, B1, B2, D3, F2) build directly on these rulings, so they should be on record before Batch 0. If the wording is wrong, an amendment fixes it. That's cheap but permanent in the history, which is why it's yours to check.
- **Reversibility and urgency.** Reversible by amendment, never by deletion. If nothing happens for a month, the relay still follows the plan. The only risk is a session working outside the plan.

The "reason" paragraphs below are my reading of the plan and the audit, not your words. Correct any that misstate why you chose.

---

## Product rulings

### Briefing links are clickable only for government and regulator domains; every other link shows its domain as plain text.
*2026-10-02, per Lee (R3)*

A briefing is model-written, and a live link reads as a source the tool vouches for. A link is clickable only if it is https, parses cleanly, and its host matches a fixed list of government and regulator domains exactly or at a dot boundary. Those links send the citizen to primary sources. Everything else is shown as text they can weigh themselves. A clickable link helps navigation; it does not verify the sentence around it, and nothing on the page may suggest that it does.

### The app's dark surfaces are warm, matched to the landing's umber, not neutral black.
*2026-10-02, per Lee (R4)*

Chosen in the 2026-10-02 UI review so that the signed-in app continues the landing's palette and doesn't go cold at sign-in. Future surface-token changes stay in the warm family, which was #0B0A09 / #121110 / #1A1816 / #292623 at the time of the ruling, and still pass the contrast test.

### Filings are on pure white with no Open Cave branding; attribution appears only on the separate guidance page, and PDF Author metadata is blank.
*2026-10-02, per Lee (R5)*

A filing goes to a public body in the citizen's name. A letterhead or wordmark makes it read as the tool's document rather than theirs, and a tinted ground prints badly. The attribution stays, because hiding it would be dishonest, but it goes on the page marked as not part of the request.

### The app wordmark is set in Fraunces, with no tagline.
*2026-10-02, per Lee (R6)*

Chosen in the 2026-10-02 UI review: one wordmark in the sidebar, the mobile header and the public layout, in the display face the landing already uses.

### The privacy contact is a dedicated privacy@opencave.ca, published only after a test message is shown to arrive and be answered.
*2026-10-02, per Lee (R7)*

The live policy's only contacts were the closed Forum and public GitHub issues. Neither is a private channel for a privacy request. A privacy address nobody reads is worse than none, so the delivery-and-reply test is part of the ruling and not an implementation detail. The forwarding target is still an open question.

### The landing grain stays and is made real: a static noise texture, never animated.
*2026-10-02, per Lee (R8)*

Lee chose this over the audit's recommendation to remove the grain. Keeping it static bounds its render cost, and it is judged on screen at desktop and phone widths with reduced motion on.

### While the Forum is gated, its nav row stays visible at readable contrast and its pages show an honest "opens later" page instead of a 404; the gate itself does not change.
*2026-10-02, per Lee (R9)*

Lee chose this over the recommendation to hide the row. A false 404 tells the citizen something untrue about a feature that exists, and a dimmed row fails contrast. This is presentation only. `isForumEnabled()` and the 2026-08-07 Forum ruling are untouched, and the Forum's API routes stay 404.

## Evidence corrections

### A "verified" flag without a dated primary source proves nothing: the BC FOI module was marked verified while carrying two wrong FIPPA citations.
*2026-10-02, per Lee*

The BC module cited s. 75(5)(a) for the public-interest fee waiver, but that ground is s. 75(5)(b). It also promised a reply in 30 calendar days, but Schedule 1 excludes holidays and Saturdays from a day. The same values had been hand-copied into three prompts. Both were corrected in `c80dcfe` against bclaws.gov.bc.ca. From now on a citation counts as verified only when it carries the source URL and the date it was checked; the plan's `sourceUrl` / `checkedOn` fields are that mechanism for public-body addresses.
