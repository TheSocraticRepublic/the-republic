# Republic Campaign Material → Claude Artifact

Paste the following prompt into Claude (claude.ai) along with your campaign material JSON to generate an interactive visualization.

## How to use

1. Copy your campaign material JSON from The Republic (use the "Copy JSON" button on any campaign card)
2. Open Claude at [claude.ai](https://claude.ai)
3. Paste the prompt below, then paste your JSON where indicated

## Prompt

---

Create a React artifact that visualizes the following campaign material data. Use Tailwind CSS for styling. The design should be clean, professional, and suitable for sharing on social media or printing.

Design requirements:
- Clean, minimalist layout with generous whitespace
- Dark text on light background (suitable for print and screen)
- Data points displayed as clear, readable statistics
- Sources cited in small text at the bottom
- Call to action prominently displayed
- The visualization should work at both 1200x630 (social media) and A4 portrait (print)

Material-specific rendering rules:

**For infographics:** Render data points as a vertical bar chart or stat cards. Highlight emphasized data points with a distinct accent color. Show comparison as a before/after split. Timeline as a compact vertical sequence. Call to action in a bordered box at the bottom.

**For fact sheets:** Render as a one-page document with a bold headline, key findings as numbered items with evidence indented below each, player profiles as a small table, and action items as a checklist.

**For social posts:** Render each variation as a social media card preview. Show the tone label (Factual / Question / Comparison) as a small badge. Include a character count indicator below each card. Hashtags in muted text.

**For talking points:** Render as presentation-ready cards, one per talking point. Each card: claim in large text, evidence below it, anticipated pushback in a muted callout, response to pushback below that.

**For timelines:** Render as a vertical timeline with a left-aligned connector line. Events as markers with date on one side and description on the other. Upcoming deadlines highlighted in a distinct color.

**For comparisons:** Render as a side-by-side comparison table. Subject (current jurisdiction) in a highlighted row at the top. Alternatives below. "Argument from existence" as a concluding statement in a callout box.

Here is the campaign material JSON:

[PASTE YOUR JSON HERE]

---

## Limitations

- Claude Artifacts run in a sandboxed iframe — no external API calls or file system access
- Available libraries: React, Tailwind CSS, Recharts, Lucide icons
- Canvas width is approximately 500-600px — design for this width
- No file download from within the artifact — use your browser's screenshot or print-to-PDF for output
- The artifact is for previewing and iterating — for production output, use the PNG/SVG export in The Republic's infographic preview, or export to Canva or Figma

## What to do after generating

If you want to refine the artifact:
- Ask Claude to "adjust the color scheme to use [color]"
- Ask Claude to "make the title larger" or "add more whitespace"
- Ask Claude to "make this print-ready at A4 size"

If you want to share it:
- Use your browser's Print → Save as PDF (set paper size to match your intended use)
- Take a full-page screenshot using your browser's built-in tool or an extension
- For social media, screenshot the artifact at 1200x630 and crop to that dimension
