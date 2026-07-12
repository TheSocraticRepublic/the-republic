# Civic Impact Strategy — OpenCanopy + The Republic
**July 2026 · Who needs these tools, how to reach them, and what to do this month**

Premise: both tools exist, work, and are deployed (opencanopy.ca, opencave.ca). Neither has users beyond Lee. The constraint is a solo operator with a four-month-old, so every recommendation below is filtered through one test: *does this create adoption without creating a support desk?* The answer is anchor partners and self-serve deep links, not marketing.

---

## Part 1 — OpenCanopy

### 1.1 The natural audience, ranked (urgency × fit)

1. **First Nations lands/referrals staff and Guardian programs.** Every BC Nation processes a firehose of forestry referrals with thin GIS capacity. OpenCanopy shows forest age, cutblocks, tenures, and conservation status in a browser with a shareable URL — no ArcGIS licence, no GIS tech. Ottawa just funded 47 Guardians initiatives for 2025–26 ($4.5M), and the BC First Nations Forestry Council runs PolicyConnect explicitly to build Nations' forest-governance capacity. Highest urgency, best fit, and Lee already has a warm path: the Tla'amin relationship via Eldred.
2. **Community groups fighting a specific cutblock or defending a specific valley.** The province-scale advocacy maps exist (Seeing Red, Ancient Forest Alliance) but they're campaign snapshots. What a residents' group needs is *their* watershed at z12 with government-truthful data and a link they can put in a council submission. OpenCanopy's URL-state deep links are exactly this. High urgency (deferral and permit decisions are ongoing), excellent fit today.
3. **Journalists covering forestry.** The Narwhal built its BC forests beat partly on other people's maps (they covered Seeing Red extensively). A reporter who can link readers to the exact tenure with layers pre-toggled will use it repeatedly. Medium urgency, high fit, and they're the distribution multiplier for audiences 1 and 2.
4. **Educators.** UBC Forestry, BCIT Renewable Resources, Sierra Club BC's school programs. The scroll-story ("8 million hectares") is already a ready-made lesson. Lower urgency, effortless fit, zero support burden — students self-serve.
5. **Carbon/covenant validators and land trusts.** Real need (forest age/extent verification for FCOP/Verra projects, covenant baselines) but they need defensible exports, not a viewer. Good fit *later* — this is the Eldred carbon storyline, so it matures on Lee's own timeline anyway.
6. **Municipal planners.** Real but slow; procurement culture. Don't chase; let UBCM-adjacent exposure happen via audiences 2–3.

**The positioning insight:** Seeing Red and AFA's maps are *advocacy artifacts* — built once, framed for a campaign, aging since their 2024 data updates. OpenCanopy's scope rule (government-truthful base, synthesis clearly separated) makes it the *neutral evidence layer*: "don't take our word for it, this is the government's own inventory." Nobody else in BC occupies that spot in an accessible web UI. That neutrality is precisely what FN referrals offices, journalists, and court/council submissions need.

### 1.2 Distribution (realistic channels)

- **The Tla'amin/Eldred relationship** — the first real user should fall out of work already underway. Use OpenCanopy live in Eldred materials and any Tla'amin conversations; "here is your territory's forest age in one link" is a better door-opener than a deck.
- **BC First Nations Forestry Council** — one email offering OpenCanopy as a free capacity tool for PolicyConnect/Guardian programs. They are the hub; Nations are the spokes. [forestrycouncil.ca]
- **The Narwhal / The Tyee** — pitch as a *reporting tool*, not a story ("every forestry piece you write can deep-link the exact valley"). The Narwhal demonstrably covers exactly this genre. One well-aimed email each.
- **BC Nature clubs + streamkeepers networks** — the naturalist-club circuit (BC Nature federation, ~50 clubs) runs on newsletters and guest talks; one newsletter blurb travels far. *(org names from model knowledge — verify current contacts before outreach)*
- **Reddit r/britishcolumbia** — where Seeing Red broke out to the general public. A "explore what's left of BC's old growth" post with the story link costs nothing. *(virality claim: model knowledge)*
- **Ancient Forest Alliance / Conservation North themselves** — not competitors; their maps are static and their audiences are pre-qualified. Offer deep links for their campaign pages.

### 1.3 Partnership model (no support desk)

- **Stay hosted, single instance, free.** It's static tiles on R2 + Netlify; marginal user cost ~zero. Do not offer self-hosting support or custom instances.
- **Deep links are the product.** Partners embed *links*, not the tool. URL state already encodes lat/lng/zoom/layers — that's the whole integration API. Zero coupling, zero obligations.
- **Ko-fi stays the funding story for now**; if an FN or ENGO partner wants a custom layer, that's a *paid data engagement* (SSC-style contract), not free support. HCTF/EcoAction-type grants could later fund named layer additions — Tim's territory.
- **Open source (already public repo)** covers the bus-factor question partners will ask.

### 1.4 What would make it 10x more useful

1. **Old-growth deferral / priority-deferral layer** (TAP priority areas). It's *the* live policy fight; the map that shows deferral status beside forest age becomes the reference. (Layer research backlog already exists in `.refresh/`.)
2. **Area report card**: draw a polygon → % old growth, % logged since year X, hectares by class, printable one-pager. The draw tool and carbon calculator already exist; this converts "viewer" into "evidence generator" for referrals, grant applications, and council submissions. Biggest single unlock.
3. **Embeds + OG images** (already on the roadmap) — what journalists actually need.
4. **A one-page "how to read this map" guide** — the entire user documentation, aimed at a band office or residents' association, not a GIS tech.

---

## Part 2 — The Republic / Open Cave

### 2.1 The natural audience, ranked

1. **Community groups already mid-fight on a local issue** (rezoning, towing, a permit, a landfill). They have motivation and a concrete question; the investigation flow (concern → briefing → Gadfly → FOI) maps 1:1 onto what they're fumbling through manually. The concern taxonomy is already general-civic. Best fit today.
2. **FOI-adjacent advocacy orgs, starting with BC FIPA.** This is the timeliest audience in the whole document: **Bill 9 (2026) is actively weakening BC's FOI regime, and FIPA is fighting it** — their 2026 report is literally titled "Transparency Systems Must Themselves Be Transparent." A tool that makes filing correct FIPPA requests trivial for ordinary citizens is infrastructure for their side of that fight. FIPA also runs public FOI assistance — Open Cave automates what their help line teaches. [fipa.bc.ca]
3. **Environmental groups investigating specific decisions** — the access-to-information lever generalizes perfectly here, and it's the multiplier audience (Part 3).
4. **Tenant organizations** (TRAC, Vancouver Tenants Union, ACORN BC — *model knowledge, verify*). Strong need, but their lever is often RTB process rather than FOI; fit is partial until a tenancy-specific action template exists. Respect the roadmap guardrail: enter a domain only when an honest lever can be named.
5. **Citizen journalists / j-schools** (Langara, UBC, The Discourse/IndigiNews community-journalism orbit — *model knowledge*). Great long-term seeding, low urgency.
6. **Municipal accountability watchdogs.** FIPPA already covers BC local public bodies, so the machinery works; what's missing is municipal-specific templates. Grow into it via audience 1's actual cases.

**The honest gate:** nobody adopts a civic tool off a landing page; they adopt off a *demonstrated outcome*. The roadmap already names P2 "First Light" (one real investigation end-to-end, FOI filed, outcome tracked). Until First Light ships, distribution effort is premature everywhere except the FIPA conversation, which is about the *ecosystem*, not user acquisition.

### 2.2 Distribution

- **BC FIPA first** — one email referencing Bill 9 and their 2026 report, offering Open Cave as open (AGPLv3) public FOI infrastructure and asking for 30 minutes. Even a critique from them is a win (they'd be validating the citation templates).
- **The First Light case study itself** — written up as a plain-language "we investigated X and here's the document trail" post. That artifact *is* the marketing; it travels through the same Narwhal/Tyee/Reddit channels as OpenCanopy.
- **Dogwood BC / CCPA-BC Policy Note orbit** (*model knowledge — verify*) — organizer networks who train volunteers to do exactly what the tool automates.
- **Civic-tech meetups (Vancouver/Victoria) and OpenNorth/Code for Canada network** — good for contributors (jurisdiction modules need legal-research labor), not end users.

### 2.3 Partnership model

- **Hosted single instance + AGPLv3** is already the right shape (the licence choice was made for exactly this threat model). Don't run instances for others.
- **The scaling unit is the jurisdiction module, and it's designed for outside labor**: `verified: false` until a legal professional checks citations. That's a pro-bono ask to **UVic's Environmental Law Centre or law-student clinics** (*model knowledge — verify current clinic intake*), not Lee's time.
- **Org-level adoption without org features:** a partner org just tells its members "use opencave.ca." Credentials/peer review handle quality internally. Resist building org accounts until someone asks twice.
- **Do not enable the Forum for launch partners** — it stays Lee-gated behind the abuse-readiness plan, correctly.

### 2.4 What would make it 10x more useful

1. **First Light shipped and written up** — worth more than any feature.
2. **Municipal FIPPA templates** (BC local public bodies) — cheap extension of the verified BC module, unlocks audiences 1 and 6.
3. **A "bring your own group" onboarding page** — one static page telling an organizer how five people run one shared investigation. Documentation, not code.
4. **Production grade back to C+** — the 4 ship-blockers are 3-quarters remediated and awaiting merge; nobody credible partners with a tool that leaks postal codes. Finish it before any outreach email is sent.

---

## Part 3 — The multiplier

**Forest investigation is the Republic's perfect first vertical, and OpenCanopy is its evidence layer.** The combined workflow:

> See it on OpenCanopy (this valley was logged / is deferred / is tenured to X) → click **"Investigate this"** → land on opencave.ca with a pre-filled concern (coordinates, layer context, tenure holder) → briefing → Gadfly → FIPPA request to the Ministry of Forests for the site plan / deferral rationale → campaign → outcome tracked.

Mechanically this is nearly free: OpenCanopy already has URL state and map popups; Open Cave's concern form takes text. A popup link that passes a pre-composed concern string via URL params is a one-day relay on each side, no shared infrastructure, no coupling — each tool stays whole without the other. Strategically it converts OpenCanopy's passive audience ("that's terrible") into the Republic's active one ("here's the FOI"), and it gives the Republic a steady stream of concrete, document-shaped, BC-jurisdiction concerns — exactly the lever the tool is built around.

And the first user of the bridge already exists: **Eldred**. The FRP old-growth question, Tla'amin territory, carbon baseline — Lee's own conservation project can be First Light, run on his own two tools, in public.

---

## Part 4 — Do this month (July 2026)

1. **Make First Light a forest investigation.** Pick one real Sea-to-Sky or Eldred-adjacent forestry decision and run it end-to-end on opencave.ca (concern → briefing → FOI filed → tracked). P2 is already the next roadmap slot; this just gives it its mission-aligned subject. Prerequisite: merge the awaiting remediation relay (grade F → C).
2. **Send two emails** (drafts for Lee's approval, per house rules): (a) BC FIPA — Bill 9 hook, offer the tool + 30 minutes; (b) The Narwhal's BC forests desk — OpenCanopy as a reporting tool with deep links. Two emails, no follow-up burden, both survive being ignored.
3. **Ship the "Investigate this" bridge** — OpenCanopy popup → opencave.ca pre-filled concern via URL params. Small relay, two repos, zero coupling. It's the artifact that makes emails (a) and (b) land, because it shows a *system*, not two side projects.

Second tier (this quarter, not this month): the OpenCanopy area report card; old-growth deferral layer; BC FNFC outreach once a Tla'amin/Eldred usage story exists to point at; municipal FIPPA templates after First Light surfaces the demand.

---

## Sources

**Verified this session (web, 2026-07-11):**
- Conservation North, "We're Seeing Red" — https://conservationnorth.org/were-seeing-red/ ; Narwhal coverage — https://thenarwhal.ca/bc-forests-old-growth-impacts-map/
- Ancient Forest Alliance old-growth maps (data updated to 2024) — https://ancientforestalliance.org/old-growth-maps/
- BC First Nations Forestry Council programs / PolicyConnect — https://forestrycouncil.ca/forest-governance/
- Indigenous Guardians: 47 initiatives funded 2025–26 ($4.5M) — https://www.canada.ca/en/environment-climate-change/news/2025/12/47-first-nations-guardians-initiatives-20252026.html
- BC FIPA; Bill 9 (2026) weakening FOI; 2026 report — https://fipa.bc.ca/ ; https://fipa.bc.ca/2026-bill-9-weakens-access-in-bc ; https://fipa.bc.ca/aa/final-report-2026

**Project state (local repos/files, read 2026-07-11):**
- `~/Projects/opencanopy/ROADMAP.md`, `ARCHITECTURE.md` (scope rule, URL state, draw/calculator, embeds/OG backlog)
- `~/Projects/the-republic/ROADMAP.md`, `ARCHITECTURE.md` (P2 First Light, horizon guardrail, AGPLv3 rationale, jurisdiction modules, production grade)
- `~/marvin/state/goals.md` (Eldred/Tla'amin, BC Conservation Fund EOI); `~/specialists/tim/CLAUDE.md` + `state/current.md` (funding landscape, Guardian Watchmen, engagement protocols)

**Model knowledge, flagged inline — verify before acting on:** BC Nature club network and streamkeepers; TRAC / Vancouver Tenants Union / ACORN BC; Dogwood BC / CCPA-BC; Langara/UBC j-schools, The Discourse/IndigiNews; UVic Environmental Law Centre clinic intake; Reddit as Seeing Red's breakout channel.
