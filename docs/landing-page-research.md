# Landing Page Design Research

Compiled 2026-05-01/02 from scroll storytelling, civic dashboard, and soulful design research.

## Approved Design References

### Guardian Firestorm (primary scroll model)
URL: theguardian.com/world/interactive/2013/may/26/firestorm-bushfire-dunalley-holmes-family
- Six-chapter interactive documentary driven by scroll
- Video, full-screen imagery, audio, and text woven together
- Scroll-triggered media transitions, ambient audio layers
- Chapter-based progression with slow dread building
- "You're inside the story, not observing it"

### Offscreen Magazine (information architecture model)
URL: offscreenmag.com
- "The human stories behind every interface"
- Typography-focused, ad-free, distraction-free
- Good model for presenting large bodies of information
- Current issues and articles layout worth modeling
- Slow, thoughtful, warm neutrals, generous spacing

### Snohetta (typography/spacing reference)
URL: snohetta.com
- Editorial, expressive, intensely visual approach
- Architecture presented as stories about places and people
- Magazine-like hierarchy, full-width photography
- Generous clean grid with ample white space, bold typography
- "Architecture as a conversation, not a monument"

## Rejected References
- Stripe — overused, not aligned
- Patagonia — not engaging enough
- Apple — too corporate, lacking soul
- Frank Chimero — nothing interesting beyond looking like a book
- Cereal Magazine — didn't load (lesson: don't build fragile things)

## Design Direction

### The Feeling
"A long-lost home" — approachable, inviting, warm. Not corporate, not over-polished.
The Republic IS the home you return to after leaving the cave.

### Philosophical Spine
Socratic — illuminate truth without opinion. Socrates doesn't advocate; he asks the
question that makes the other person see what was already there. The landing page is
a philosophical invitation, not a product demo.

### Story Arc (4 acts, rezoning scenario)
1. **Confusion** — A rezoning notice arrives. The park where your kids play is being
   replaced. The document is impenetrable. This is the cave.
2. **Understanding** — Each scroll section asks a question, not shows a feature.
   Scout finds documents, Oracle translates, Gadfly asks what you didn't know to ask.
3. **Action** — Lever generates your FOI request. Vote Tracker shows your MP's record.
   The output is a real, usable filing.
4. **Agency** — You're more capable than before. The tool recedes.
   "The unexamined institution is not worth enduring."

### Technical Stack
- GSAP ScrollTrigger for scroll-synced animations
- Lenis for smooth scroll (autoRaf: false with GSAP ticker)
- Intersection Observer for lazy loading
- prefers-reduced-motion fallback (simplify to fade-in reveals)
- Performance: 55+ FPS, CLS < 0.05, GPU-composited only (transform, opacity)

### Design Elements That Create Warmth
- Earthy, muted tones — warm off-whites, not pure white
- Humanist or serif typography with personality
- Photography showing hands, light, process (not studio shots)
- Transitions that feel like turning pages, not triggering mechanisms
- Generous whitespace, unhurried pacing
- Conversational voice, not brand voice

## Dashboard Light Mode (shipped)

CSS variable dual-token system already implemented:
- Surface: #FAFAF9 (page), #FFFFFF (cards), #F5F4F2 (sidebar), #EEECE8 (hover)
- Text: #1C1917 (primary), #44403C (secondary), #78716C (muted), #A8A29E (faint)
- Borders: rgba(28,25,23,0.06/0.12)
- Shadows: warm-tinted layered (Josh Comeau method)
- Dark island pattern for Gadfly slide-over
- .dark class preserved for future toggle
