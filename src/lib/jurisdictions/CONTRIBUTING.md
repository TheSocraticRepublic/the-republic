# Adding a New Jurisdiction Module

This guide explains how to create a jurisdiction module for the Republic platform. Jurisdiction modules define the FOI framework, public bodies, concern categories, and environmental assessment processes for a specific province or territory.

## Overview

Each jurisdiction is a directory under `src/lib/jurisdictions/{id}/` containing six files. The `id` is a lowercase two-letter provincial abbreviation (e.g., `bc`, `ab`, `on`, `qc`, `ns`).

```
src/lib/jurisdictions/{id}/
├── index.ts                # Module entry point and re-exports
├── foi-framework.ts        # FOI legislation, sections, and letter template
├── concern-categories.ts   # Concern categories with keywords and documents
├── public-bodies.ts        # FOI coordinators and contact addresses
├── portals.ts              # Known public document portals
└── assessment-framework.ts # Environmental assessment process
```

## Step 1: Research the FOI Legislation

Before writing any code, you need authoritative sources for:

- The name and full citation of the provincial FOI legislation
- The section numbers for: right of access, duty to assist, time limit, fee waiver, and review mechanism
- The name of the oversight body (e.g., Information and Privacy Commissioner)
- The response time limit in calendar or business days

**Primary sources:**
- The provincial Queen's Printer / legislative assembly website for the current consolidated statute
- The provincial Information and Privacy Commissioner's website for practice guidance
- **Do not rely on AI training data for legal citations.** Verify against the official statute text.

All new modules ship with `verified: false` on the `FOIFramework`. The `verified` flag is only set to `true` after a legal professional has reviewed the citations. Add `// VERIFY:` comments next to any citation you could not confirm from primary sources.

## Step 2: Create the FOI Framework

Create `src/lib/jurisdictions/{id}/foi-framework.ts`:

```typescript
import type { FOIFramework } from '../types'

// VERIFY: All citations should be checked against the current statute text.

export const {id}FoiFramework: FOIFramework = {
  name: 'FOIP',                              // Short name of the Act
  fullCitation: 'Full Act Name, Citation',   // Full statutory citation
  verified: false,                           // Set to true only after legal review
  sections: {
    rightOfAccess: 's. X',                   // Section granting right to request
    dutyToAssist: 's. X',                    // Section requiring duty to assist
    timeLimit: { section: 's. X', days: 30 }, // Response deadline
    feeWaiver: 's. X',                       // Fee waiver provision (optional)
    review: 's. X',                          // Review mechanism section (optional)
  },
  letterTemplate: `Dear FOI Coordinator,

Under [Full Act Name], [Citation], s. X(1), I request access to the following records:

{records_description}

...`,                                        // Must contain {records_description}
  responseTimeline: '30 calendar days',      // Human-readable timeline
}
```

The `letterTemplate` must contain the `{records_description}` placeholder. The template should cite the Act and specific sections in plain language.

## Step 3: Create Concern Categories

Create `src/lib/jurisdictions/{id}/concern-categories.ts`. Categories represent the types of civic issues residents bring to the platform.

**Requirements:**
- At least 10 categories total
- Include province-specific categories reflecting the jurisdiction's economic and political context
- All keywords must be lowercase
- No duplicate keywords within a single category

**Province-specific examples:**
- Alberta: oil sands, pipeline, irrigation rights, cattle/agriculture
- Ontario: transit/Metrolinx, Greenbelt, rent control
- Quebec: language rights, Hydro-Quebec
- Nova Scotia: offshore energy, fisheries

Each category needs:

```typescript
{
  category: 'Category Name',
  keywords: ['keyword1', 'keyword2'],   // All lowercase
  documents: [
    {
      type: 'Document Type Name',
      description: 'What this document is and why it matters.',
      access: 'public' | 'fippa_required' | 'restricted',
      typicalLocation: 'Where to find it.',
    },
  ],
}
```

The file must also export a `getDocumentStructureContext()` function that formats the categories as a plain-text block for injection into system prompts. Copy the pattern from an existing module — the structure is identical, only the header changes.

## Step 4: Create Public Bodies

Create `src/lib/jurisdictions/{id}/public-bodies.ts`. List the FOI coordinators citizens are most likely to contact.

**Requirements:**
- At least 8 entries
- Include major municipal governments and key provincial bodies
- Every entry must have `name`, `foiAddress`, and `jurisdiction`
- Add `// VERIFY:` comments on all addresses — these change and must be checked before use

```typescript
{
  name: 'City of ...',
  foiAddress: 'FOI Coordinator, ...',  // VERIFY
  jurisdiction: 'city-slug',
  email: 'foi@...ca',                  // VERIFY — optional
  phone: '...',                        // VERIFY — optional
}
```

## Step 5: Create Portals

Create `src/lib/jurisdictions/{id}/portals.ts`. Document known public-facing web portals for each major jurisdiction.

**Requirements:**
- At least 6 portal entries
- Include city portals for major municipalities and provincial open data

The file must also export a `getJurisdictionPortalContext(jurisdictionName: string)` function. Copy the pattern from an existing module — the implementation is identical.

```typescript
'City of ...': {
  name: 'City of ...',
  url: 'https://...',           // VERIFY
  description: '...',
  documentTypes: [
    'Bylaws (https://...)',    // VERIFY
    'Council Minutes (https://...)',
  ],
},
```

## Step 6: Create the Assessment Framework

Create `src/lib/jurisdictions/{id}/assessment-framework.ts`. This documents the provincial environmental assessment process.

Research the provincial EA Act and identify:
- The governing statute and citation
- The provincial EA registry URL
- Document types produced during the EA process
- Process stages and their typical duration
- Public participation opportunities

```typescript
export const {id}AssessmentFramework: AssessmentFramework = {
  name: 'Province Environmental Assessment',
  authority: 'Environmental Assessment Act, ...',  // VERIFY
  registryUrl: 'https://...',                      // VERIFY
  documentTypes: [...],
  processStages: [...],
  publicParticipation: [...],
  keyStatutes: [...],
}
```

## Step 7: Create the Index

Create `src/lib/jurisdictions/{id}/index.ts`:

```typescript
import type { JurisdictionModule } from '../types'
import { {id}ConcernCategories } from './concern-categories'
import { {id}PublicBodies } from './public-bodies'
import { {id}Portals } from './portals'
import { {id}FoiFramework } from './foi-framework'
import { {id}AssessmentFramework } from './assessment-framework'

const {id}Module: JurisdictionModule = {
  id: '{id}',
  name: 'Province Name',
  country: 'Canada',
  foiFramework: {id}FoiFramework,
  assessmentFramework: {id}AssessmentFramework,
  concernCategories: {id}ConcernCategories,
  publicBodies: {id}PublicBodies,
  portals: {id}Portals,
}

export default {id}Module

export { getDocumentStructureContext } from './concern-categories'
export { getJurisdictionPortalContext } from './portals'
```

## Step 8: Register the Module

Add the jurisdiction to the registry in `src/lib/jurisdictions/index.ts`:

```typescript
const JURISDICTION_REGISTRY = {
  'bc': () => import('./bc'),
  'ab': () => import('./ab'),
  'on': () => import('./on'),
  '{id}': () => import('./{id}'),  // Add here
}
```

Also update the `detectJurisdiction` function to match province and city names:

```typescript
if (
  normalized.includes('province name') ||
  normalized.includes('major city') ||
  ...
) {
  return '{id}'
}
```

## Step 9: Write Tests

Add a test suite in `tests/unit/jurisdictions.test.ts` following the pattern established for BC, Alberta, and Ontario. Each module needs tests for:

- Module loads successfully
- Required top-level fields are present
- FOI framework has required fields and cites the correct Act
- Letter template contains `{records_description}` and Act citations
- Concern categories include province-specific items (by keyword)
- Public bodies include the expected major bodies
- All keywords are lowercase
- No duplicate keywords within a category
- Assessment framework references the correct Act
- `verified` flag is `false` for new unverified modules

## Step 10: Run Tests

```bash
npm test
```

All tests in `tests/unit/jurisdictions.test.ts` must pass before the module is considered complete.

## Legal Review Process

Once a module is built and tested:

1. File a GitHub issue titled "Legal review: {Province} FOIP module"
2. List all `// VERIFY:` comments in the issue with the source you found and the citation as written
3. A legal professional reviews the citations against the current consolidated statute
4. After review, the `// VERIFY:` comments are removed and `verified: true` is set on the `FOIFramework`
5. The runtime warning shown to users is removed

Until `verified: true`, the platform displays: *"Legal citations in this module have not been verified by a legal professional. Verify independently before relying on them."*

## Checklist

- [ ] `foi-framework.ts` — verified flag is `false`, `// VERIFY:` on all citations, `{records_description}` in template
- [ ] `concern-categories.ts` — 10+ categories, province-specific categories, all keywords lowercase, no duplicates, `getDocumentStructureContext()` exported
- [ ] `public-bodies.ts` — 8+ entries, `// VERIFY:` on all addresses, all entries have name/foiAddress/jurisdiction
- [ ] `portals.ts` — 6+ portals, `// VERIFY:` on all URLs, `getJurisdictionPortalContext()` exported
- [ ] `assessment-framework.ts` — `// VERIFY:` on all citations
- [ ] `index.ts` — imports all five files, exports default module and utility functions
- [ ] `src/lib/jurisdictions/index.ts` — module registered in `JURISDICTION_REGISTRY`, `detectJurisdiction` updated
- [ ] Tests written and passing
- [ ] Legal review issue filed
