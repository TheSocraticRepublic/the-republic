/**
 * Seed the local QA harness database. Synthetic data only, except the two
 * federal divisions, which are real and carry their openparliament.ca URLs.
 *
 *   tsx scripts/qa/seed-local.ts              full seed (once, on a fresh database)
 *   tsx scripts/qa/seed-local.ts --login-code  issue a fresh login code for user A
 *
 * Run it through scripts/qa/harness.ts, which launches it with `env -i` and
 * the harness's own variables. It refuses to run unless:
 *   - QA_LOCAL_DB=1, and
 *   - assertLocalQaTargets() passes: BOTH the effective migration URL
 *     (DIRECT_DATABASE_URL, falling back to DATABASE_URL) and DATABASE_URL
 *     point at a loopback host, port 55432, and a database ending `_qa`.
 *
 * It connects to DATABASE_URL with TLS decided by migrationSslConfig(), which
 * returns `false` only for QA_LOCAL_DB=1 plus a loopback host, and throws for
 * anything else.
 */

import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, eq, isNull } from 'drizzle-orm'
import * as schema from '../../src/lib/db/schema'
import { normalizeBallot, normalizeVoteResult, extractSlug } from '../../src/lib/parliament/types'
import { assertLocalQaTargets } from '../lib/local-db-guard'
import { migrationSslConfig } from '../lib/supabase-ssl'
import {
  SEEDED_LETTER_FIXTURES,
  PUBLIC_COMMENT_FIXTURE,
  SEEDED_BRIEFING,
  SEEDED_BRIEFING_CONCERN,
  type LetterFixture,
} from '../../tests/fixtures/letters'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Synthetic identities. Fixed ids so mint-session.ts and the checks can name
// them without a query.
// ---------------------------------------------------------------------------

export const QA_USER_A = {
  id: 'a0000000-0000-4000-8000-00000000000a',
  email: 'qa-owner-a@example.test',
  displayName: 'qa-owner-a',
} as const

export const QA_USER_B = {
  id: 'b0000000-0000-4000-8000-00000000000b',
  email: 'qa-other-b@example.test',
  displayName: 'qa-other-b',
} as const

/**
 * User A's login code. A synthetic constant: it opens only the disposable
 * harness database, and only through a code row this script inserts.
 */
export const QA_LOGIN_CODE = '24681357'

export const QA_INVESTIGATION_ID = 'c0000000-0000-4000-8000-0000000000c1'

const STATUSES = ['draft', 'final', 'filed'] as const

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function letterMetadata(fixture: LetterFixture, status: (typeof STATUSES)[number]): Record<string, unknown> {
  const seed = fixture.seed!
  const metadata: Record<string, unknown> = {
    publicBody: seed.publicBody,
    addressee: seed.publicBody,
    description: `Synthetic QA fixture: ${fixture.id}`,
  }
  if (seed.jurisdiction) metadata.jurisdiction = seed.jurisdiction
  if (fixture.format === 'marker-v1') {
    metadata.letterFormat = 'marker-v1'
    metadata.promptVersion = '0.6.0'
  }
  if (status === 'filed') metadata.filedAt = new Date().toISOString()
  return metadata
}

function connect() {
  if (process.env.QA_LOCAL_DB !== '1') {
    throw new Error('QA_LOCAL_DB=1 is not set; seed-local refuses to run outside the QA harness')
  }
  // Both URLs, not DATABASE_URL alone: a remote DIRECT_DATABASE_URL must stop
  // the seed even though the seed itself dials DATABASE_URL.
  assertLocalQaTargets()
  const databaseUrl = process.env.DATABASE_URL as string
  const client = postgres(databaseUrl, { max: 1, prepare: false, ssl: migrationSslConfig(databaseUrl) })
  return { client, db: drizzle(client, { schema }) }
}

async function issueLoginCode(db: ReturnType<typeof connect>['db']): Promise<void> {
  // verifyMagicCode() reads the first active code for the email, so retire any
  // earlier unused code before issuing the new one.
  await db
    .update(schema.magicCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.magicCodes.email, QA_USER_A.email), isNull(schema.magicCodes.usedAt)))
  await db.insert(schema.magicCodes).values({
    email: QA_USER_A.email,
    code: sha256Hex(QA_LOGIN_CODE),
    expiresAt: new Date(Date.now() + 30 * 60_000),
  })
  console.log(`login code issued for ${QA_USER_A.email} (expires in 30 minutes)`)
}

async function seedAll(db: ReturnType<typeof connect>['db']): Promise<void> {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, QA_USER_A.id))
  if (existing) {
    throw new Error('the QA database is already seeded; tear it down (harness down) and start fresh')
  }

  await db.transaction(async (tx) => {
    // --- Users and profiles ------------------------------------------------
    for (const u of [QA_USER_A, QA_USER_B]) {
      await tx.insert(schema.users).values({ id: u.id, email: u.email })
      await tx
        .insert(schema.userProfiles)
        .values({ userId: u.id, displayName: u.displayName, apHandle: u.displayName })
    }

    // --- Mirror reference jurisdictions (the repo's own real data) -----------
    const jurisdictionSeeds = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'seeds', 'jurisdictions.json'), 'utf-8')
    ) as Array<typeof schema.jurisdictions.$inferInsert>
    for (const j of jurisdictionSeeds) {
      await tx.insert(schema.jurisdictions).values({
        name: j.name,
        country: j.country,
        province: j.province ?? null,
        municipalType: j.municipalType,
        population: j.population ?? null,
        dataPortalUrl: j.dataPortalUrl ?? null,
      })
    }

    // --- Federal votes: two real divisions -----------------------------------
    const mpIds = new Map<string, string>()
    for (const [slug, name, party, ridingName, ridingProvince] of QA_MPS) {
      const [row] = await tx
        .insert(schema.federalMps)
        .values({ oparlSlug: slug, name, party, ridingName, ridingProvince, active: true })
        .returning({ id: schema.federalMps.id })
      mpIds.set(slug, row.id)
    }

    const billIds = new Map<string, string>()
    for (const bill of [QA_BILL_C_39, QA_BILL_C_218]) {
      const [row] = await tx
        .insert(schema.federalBills)
        .values({
          number: bill.number,
          session: bill.session,
          titleEn: bill.name.en,
          titleFr: bill.name.fr,
          shortTitleEn: bill.short_title.en || null,
          sponsorMpId: mpIds.get(extractSlug(bill.sponsor_politician_url)) ?? null,
          statusCode: bill.status_code,
          introduced: bill.introduced,
          isLaw: bill.law,
          legisInfoUrl: bill.legisinfo_url,
          metadata: { source: `https://openparliament.ca${bill.url}` },
        })
        .returning({ id: schema.federalBills.id })
      billIds.set(bill.url, row.id)
    }

    const ballotCode: Record<string, string> = { Y: 'Yes', N: 'No', P: 'Paired', D: "Didn't vote" }
    const voteIds = new Map<number, string>()
    for (const [vote, ballots] of [
      [QA_VOTE_177, QA_BALLOTS_177],
      [QA_VOTE_178, QA_BALLOTS_178],
    ] as const) {
      const [row] = await tx
        .insert(schema.federalVotes)
        .values({
          session: vote.session,
          number: vote.number,
          date: vote.date,
          descriptionEn: vote.description.en,
          descriptionFr: vote.description.fr,
          result: normalizeVoteResult(vote.result),
          yeaTotal: vote.yea_total,
          nayTotal: vote.nay_total,
          pairedTotal: vote.paired_total,
          partyVotes: vote.party_votes,
          billId: vote.bill_url ? billIds.get(vote.bill_url) ?? null : null,
        })
        .returning({ id: schema.federalVotes.id })
      voteIds.set(vote.number, row.id)

      if (ballots.length !== QA_MPS.length) {
        throw new Error(`ballot string for ${vote.url} has ${ballots.length} entries, expected ${QA_MPS.length}`)
      }
      const counts = { yes: 0, no: 0, paired: 0, didnt_vote: 0 }
      for (let i = 0; i < QA_MPS.length; i++) {
        const raw = ballotCode[ballots[i]]
        if (!raw) throw new Error(`unknown ballot code "${ballots[i]}" in ${vote.url}`)
        const ballot = normalizeBallot(raw)
        counts[ballot]++
        await tx
          .insert(schema.federalMpBallots)
          .values({ voteId: row.id, mpId: mpIds.get(QA_MPS[i][0])!, ballot })
      }
      // The recorded ballots must reproduce the source's own totals.
      if (counts.yes !== vote.yea_total || counts.no !== vote.nay_total || counts.paired !== vote.paired_total) {
        throw new Error(`ballots for ${vote.url} do not reproduce the source totals`)
      }
    }

    // --- User A's completed investigation -------------------------------------
    const now = new Date()
    await tx.insert(schema.investigations).values({
      id: QA_INVESTIGATION_ID,
      userId: QA_USER_A.id,
      concern: SEEDED_BRIEFING_CONCERN,
      jurisdictionName: 'Victoria, British Columbia',
      policyArea: 'environment',
      briefingText: SEEDED_BRIEFING,
      briefingCompletedAt: now,
      generationStartedAt: now,
      status: 'complete',
    })
    await tx.insert(schema.investigationVotes).values({
      investigationId: QA_INVESTIGATION_ID,
      voteId: voteIds.get(QA_VOTE_178.number)!,
      relevanceExplanation: 'Synthetic QA link. Not a real relevance finding.',
    })

    // --- Oracle document with an analysis ------------------------------------
    const [doc] = await tx
      .insert(schema.documents)
      .values({
        userId: QA_USER_A.id,
        title: 'Mill Creek Watershed Plan (synthetic QA document)',
        documentType: 'policy',
        rawText:
          'Mill Creek Watershed Plan (synthetic). Section 1: the plan applies to the Mill Creek drainage above the intake. ' +
          'Section 2: water-quality monitoring is voluntary. Section 3: the district may approve cutting permits after notice.',
        pageCount: 1,
        wordCount: 42,
        status: 'ready',
        investigationId: QA_INVESTIGATION_ID,
      })
      .returning({ id: schema.documents.id })
    await tx.insert(schema.analyses).values({
      documentId: doc.id,
      summary: 'A synthetic watershed plan that makes monitoring voluntary and lets the district approve permits after notice.',
      keyFindings: ['- Monitoring is voluntary (Section 2).\n- Approval needs only notice, not consultation (Section 3).'],
      powerMap: { raw: '- The district decides.\n- The water users are told.' },
      missingInfo: ['- Who reads the monitoring results.'],
      hiddenAssumptions: ['- That notice is the same as consent.'],
      questionsToAsk: ['1. Who acts on a bad monitoring result?'],
      model: 'qa-ai-stub',
      promptVersion: 'qa',
    })

    // --- Gadfly session with turns -------------------------------------------
    const [session] = await tx
      .insert(schema.gadflySessions)
      .values({
        userId: QA_USER_A.id,
        documentId: doc.id,
        title: 'Who answers for the intake? (synthetic QA session)',
        questionCount: 2,
        investigationId: QA_INVESTIGATION_ID,
      })
      .returning({ id: schema.gadflySessions.id })
    const turns = [
      { role: 'gadfly' as const, questionType: 'clarifying' as const, content: 'What do you think "after notice" asks of the district?' },
      { role: 'citizen' as const, questionType: null, content: 'Only that it tells us. It does not have to listen.' },
      { role: 'gadfly' as const, questionType: 'probing' as const, content: 'If it only has to tell you, who is the plan written for?' },
    ]
    for (let i = 0; i < turns.length; i++) {
      await tx.insert(schema.gadflyTurns).values({ sessionId: session.id, turnIndex: i, ...turns[i] })
    }

    // --- Lever actions: every seeded letter fixture in every status ----------
    for (const fixture of SEEDED_LETTER_FIXTURES) {
      const seed = fixture.seed!
      for (const status of STATUSES) {
        await tx.insert(schema.leverActions).values({
          userId: QA_USER_A.id,
          investigationId: seed.linkInvestigation ? QA_INVESTIGATION_ID : null,
          actionType: seed.actionType,
          title: `FIPPA Request: QA ${seed.key} (${status})`,
          content: fixture.content,
          metadata: letterMetadata(fixture, status),
          status,
        })
      }
    }
    await tx.insert(schema.leverActions).values({
      userId: QA_USER_A.id,
      investigationId: QA_INVESTIGATION_ID,
      actionType: 'public_comment',
      title: 'Public Comment: QA public comment (draft)',
      content: PUBLIC_COMMENT_FIXTURE.content,
      metadata: { publicBody: null, addressee: null, description: 'Synthetic QA public comment' },
      status: 'draft',
    })
    // B owns one action, so "B does not see A's actions" is checked against a
    // non-empty list rather than passing because B sees nothing at all.
    await tx.insert(schema.leverActions).values({
      userId: QA_USER_B.id,
      actionType: 'public_comment',
      title: 'Public Comment: QA user B (draft)',
      content: 'A synthetic public comment owned by QA user B.',
      metadata: { publicBody: null, addressee: null, description: 'Synthetic QA comment for user B' },
      status: 'draft',
    })
  })

  console.log(
    `seeded: users A and B; ${SEEDED_LETTER_FIXTURES.length * STATUSES.length} FIPPA actions + 1 public comment for A, 1 action for B; ` +
      `1 investigation, 1 document + analysis, 1 Gadfly session; ${QA_MPS.length} MPs, 2 bills, 2 divisions`
  )
  await issueLoginCode(db)
}

async function main() {
  const loginCodeOnly = process.argv.includes('--login-code')
  const { client, db } = connect()
  try {
    if (loginCodeOnly) await issueLoginCode(db)
    else await seedAll(db)
  } finally {
    await client.end()
  }
}

// ---------------------------------------------------------------------------
// Two real House of Commons divisions, 45th Parliament, 1st session.
//
// Source: api.openparliament.ca (API-Version v1), fetched 2026-10-11:
//   https://openparliament.ca/votes/45-1/177/  (2nd reading of Bill C-218, Failed 141-187, 6 paired)
//   https://openparliament.ca/votes/45-1/178/  (2nd reading of Bill C-39, Passed 296-26, 10 paired)
//   https://openparliament.ca/bills/45-1/C-39/
//   https://openparliament.ca/bills/45-1/C-218/
//   MPs: https://api.openparliament.ca/politicians/?format=json&limit=500 (337 current members)
//   Ballots: https://api.openparliament.ca/votes/ballots/?vote=/votes/45-1/177/ (and 178)
//
// Transcribed mechanically from those responses, not edited. The recorded
// ballots reproduce each division's yea, nay and paired totals exactly; the
// seed re-checks that and refuses to run if they ever disagree.
// ---------------------------------------------------------------------------

// MPs: [openparliament slug, name, party short name, riding, province]
const QA_MPS: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ["aaron-gunn","Aaron Gunn","Conservative","North Island—Powell River","BC"],
  ["abdelhaq-sari","Abdelhaq Sari","Liberal","Bourassa","QC"],
  ["adam-chambers","Adam Chambers","Conservative","Simcoe North","ON"],
  ["adam-van-koeverden","Adam van Koeverden","Liberal","Burlington North—Milton West","ON"],
  ["ahmed-hussen","Ahmed Hussen","Liberal","York South—Weston—Etobicoke","ON"],
  ["alana-hirtle","Alana Hirtle","Liberal","Cumberland—Colchester","NS"],
  ["alex-ruff","Alex Ruff","Conservative","Bruce—Grey—Owen Sound","ON"],
  ["alexandra-mendes","Alexandra Mendes","Liberal","Brossard—Saint-Lambert","QC"],
  ["alexis-brunelle-duceppe","Alexis Brunelle-Duceppe","Bloc","Lac-Saint-Jean","QC"],
  ["alexis-deschenes","Alexis Deschênes","Bloc","Gaspésie—Les Îles-de-la-Madeleine—Listuguj","QC"],
  ["ali-ehsassi","Ali Ehsassi","Liberal","Willowdale","ON"],
  ["amandeep-sodhi","Amandeep Sodhi","Liberal","Brampton Centre","ON"],
  ["amanpreet-gill","Amanpreet S. Gill","Conservative","Calgary Skyview","AB"],
  ["amarjeet-gill","Amarjeet Gill","Conservative","Brampton West","ON"],
  ["andreanne-larouche","Andréanne Larouche","Bloc","Shefford","QC"],
  ["andrew-lawton","Andrew Lawton","Conservative","Elgin—St. Thomas—London South","ON"],
  ["andrew-scheer","Andrew Scheer","Conservative","Regina—Qu'Appelle","SK"],
  ["angelo-iacono","Angelo Iacono","Liberal","Alfred-Pellan","QC"],
  ["anita-anand","Anita Anand","Liberal","Oakville East","ON"],
  ["anita-vandenbeld","Anita Vandenbeld","Liberal","Ottawa West—Nepean","ON"],
  ["anju-dhillon","Anju Dhillon","Liberal","Dorval—Lachine—LaSalle","QC"],
  ["anna-gainey","Anna Gainey","Liberal","Notre-Dame-de-Grâce—Westmount","QC"],
  ["anna-roberts","Anna Roberts","Conservative","King—Vaughan","ON"],
  ["annie-koutrakis","Annie Koutrakis","Liberal","Vimy","QC"],
  ["anthony-housefather","Anthony Housefather","Liberal","Mount Royal","QC"],
  ["arielle-kayabaga","Arielle Kayabaga","Liberal","London West","ON"],
  ["arnold-viersen","Arnold Viersen","Conservative","Peace River—Westlock","AB"],
  ["arpan-khanna","Arpan Khanna","Conservative","Oxford","ON"],
  ["aslam-rana","Aslam Rana","Liberal","Hamilton Centre","ON"],
  ["bardish-chagger","Bardish Chagger","Liberal","Waterloo","ON"],
  ["ben-carr","Ben Carr","Liberal","Winnipeg South Centre","MB"],
  ["ben-lobb","Ben Lobb","Conservative","Huron—Bruce","ON"],
  ["bernard-genereux","Bernard Généreux","Conservative","Côte-du-Sud—Rivière-du-Loup—Kataskomiq—Témiscouata","QC"],
  ["bienvenu-olivier-ntumba","Bienvenu-Olivier Ntumba","Liberal","Mont-Saint-Bruno—L’Acadie","QC"],
  ["billy-morin","Billy Morin","Conservative","Edmonton Northwest","AB"],
  ["blaine-calkins","Blaine Calkins","Conservative","Ponoka—Didsbury","AB"],
  ["blake-richards","Blake Richards","Conservative","Airdrie—Cochrane","AB"],
  ["bob-zimmer","Bob Zimmer","Conservative","Prince George—Peace River—Northern Rockies","BC"],
  ["bobby-morrissey","Bobby Morrissey","Liberal","Egmont","PE"],
  ["brad-redekopp","Brad Redekopp","Conservative","Saskatoon West","SK"],
  ["brad-vis","Brad Vis","Conservative","Mission—Matsqui—Abbotsford","BC"],
  ["braeden-caley","Braeden Caley","Liberal","North Vancouver—Capilano","BC"],
  ["braedon-clark","Braedon Clark","Liberal","Sackville—Bedford—Preston","NS"],
  ["branden-leslie","Branden Leslie","Conservative","Portage—Lisgar","MB"],
  ["brendan-hanley","Brendan Hanley","Liberal","Yukon","YT"],
  ["bruce-fanjoy","Bruce Fanjoy","Liberal","Carleton","ON"],
  ["buckley-belanger","Buckley Belanger","Liberal","Desnethé—Missinippi—Churchill River","SK"],
  ["burton-bailey","Burton Bailey","Conservative","Red Deer","AB"],
  ["carlos-leitao","Carlos Leitão","Liberal","Marc-Aurèle-Fortin","QC"],
  ["carol-anstey","Carol Anstey","Conservative","Long Range Mountains","NL"],
  ["caroline-desrochers","Caroline Desrochers","Liberal","Trois-Rivières","QC"],
  ["chak-au","Chak Au","Conservative","Richmond Centre—Marpole","BC"],
  ["charles-sousa","Charles Sousa","Liberal","Mississauga—Lakeshore","ON"],
  ["cheryl-gallant","Cheryl Gallant","Conservative","Algonquin—Renfrew—Pembroke","ON"],
  ["chi-nguyen","Chi Nguyen","Liberal","Spadina—Harbourfront","ON"],
  ["chris-bittle","Chris Bittle","Liberal","St. Catharines","ON"],
  ["chris-dentremont","Chris d'Entremont","Liberal","Acadie—Annapolis","NS"],
  ["chris-lewis","Chris Lewis","Conservative","Essex","ON"],
  ["chris-malette","Chris Malette","Liberal","Bay of Quinte","ON"],
  ["chris-warkentin","Chris Warkentin","Conservative","Grande Prairie","AB"],
  ["christine-normandin","Christine Normandin","Bloc","Saint-Jean","QC"],
  ["claude-debellefeuille","Claude DeBellefeuille","Bloc","Beauharnois—Salaberry—Soulanges—Huntingdon","QC"],
  ["claude-guay","Claude Guay","Liberal","LaSalle—Émard—Verdun","QC"],
  ["clifford-small","Clifford Small","Conservative","Central Newfoundland","NL"],
  ["colin-reynolds","Colin Reynolds","Conservative","Elmwood—Transcona","MB"],
  ["connie-cody","Connie Cody","Conservative","Cambridge","ON"],
  ["corey-hogan","Corey Hogan","Liberal","Calgary Confederation","AB"],
  ["corey-tochor","Corey Tochor","Conservative","Saskatoon—University","SK"],
  ["costas-menegakis","Costas Menegakis","Conservative","Aurora—Oak Ridges—Richmond Hill","ON"],
  ["dalwinder-gill","Dalwinder Gill","Conservative","Calgary McKnight","AB"],
  ["dan-albas","Dan Albas","Conservative","Okanagan Lake West—South Kelowna","BC"],
  ["dan-mazier","Dan Mazier","Conservative","Riding Mountain","MB"],
  ["dan-muys","Dan Muys","Conservative","Flamborough—Glanbrook—Brant North","ON"],
  ["dane-lloyd","Dane Lloyd","Conservative","Parkland","AB"],
  ["daniel-gobeil","Daniel Gobeil","Liberal","Chicoutimi—Le Fjord","QC"],
  ["danielle-martin","Danielle Martin","Liberal","University—Rosedale","ON"],
  ["darren-fisher","Darren Fisher","Liberal","Dartmouth—Cole Harbour","NS"],
  ["dave-epp","Dave Epp","Conservative","Chatham-Kent—Leamington","ON"],
  ["david-bexte","David Bexte","Conservative","Bow River","AB"],
  ["david-mcguinty","David McGuinty","Liberal","Ottawa South","ON"],
  ["david-mckenzie","David McKenzie","Conservative","Calgary Signal Hill","AB"],
  ["david-myles","David Myles","Liberal","Fredericton—Oromocto","NB"],
  ["dean-allison","Dean Allison","Conservative","Niagara West","ON"],
  ["doly-begum","Doly Begum","Liberal","Scarborough Southwest","ON"],
  ["dominic-leblanc","Dominic LeBlanc","Liberal","Beauséjour","NB"],
  ["dominique-orourke","Dominique O'Rourke","Liberal","Guelph","ON"],
  ["dominique-vien","Dominique Vien","Conservative","Bellechasse—Les Etchemins—Lévis","QC"],
  ["don-davies","Don Davies","NDP","Vancouver Kingsway","BC"],
  ["doug-eyolfson","Doug Eyolfson","Liberal","Winnipeg West","MB"],
  ["doug-shipley","Doug Shipley","Conservative","Barrie—Springwater—Oro-Medonte","ON"],
  ["eleanor-olszewski","Eleanor Olszewski","Liberal","Edmonton Centre","AB"],
  ["elisabeth-briere","Élisabeth Brière","Liberal","Sherbrooke","QC"],
  ["elizabeth-may","Elizabeth May","Green","Saanich—Gulf Islands","BC"],
  ["ellis-ross","Ellis Ross","Conservative","Skeena—Bulkley Valley","BC"],
  ["emma-harrison","Emma Harrison","Liberal","Peterborough","ON"],
  ["emmanuella-lambropoulos","Emmanuella Lambropoulos","Liberal","Saint-Laurent","QC"],
  ["eric-duncan","Eric Duncan","Conservative","Stormont—Dundas—Glengarry","ON"],
  ["eric-lefebvre","Éric Lefebvre","Conservative","Richmond—Arthabaska","QC"],
  ["eric-melillo","Eric Melillo","Conservative","Kenora—Kiiwetinoong","ON"],
  ["eric-st-pierre","Eric St-Pierre","Liberal","Honoré-Mercier","QC"],
  ["ernie-klassen","Ernie Klassen","Liberal","South Surrey—White Rock","BC"],
  ["evan-solomon","Evan Solomon","Liberal","Toronto Centre","ON"],
  ["fares-al-soud","Fares Al Soud","Liberal","Mississauga Centre","ON"],
  ["faycal-el-khoury","Fayçal El-Khoury","Liberal","Laval—Les Îles","QC"],
  ["francis-scarpaleggia","Francis Scarpaleggia","Liberal","Lac-Saint-Louis","QC"],
  ["francois-philippe-champagne","François-Philippe Champagne","Liberal","Saint-Maurice—Champlain","QC"],
  ["frank-caputo","Frank Caputo","Conservative","Kamloops—Thompson—Nicola","BC"],
  ["fraser-tolmie","Fraser Tolmie","Conservative","Moose Jaw—Lake Centre—Lanigan","SK"],
  ["fred-davies","Fred Davies","Conservative","Niagara South","ON"],
  ["gabriel-hardy","Gabriel Hardy","Conservative","Montmorency—Charlevoix","QC"],
  ["gabriel-ste-marie","Gabriel Ste-Marie","Bloc","Joliette—Manawan","QC"],
  ["gaetan-malette","Gaétan Malette","Conservative","Kapuskasing—Timmins—Mushkegowuk","ON"],
  ["garnett-genuis","Garnett Genuis","Conservative","Sherwood Park—Fort Saskatchewan","AB"],
  ["gary-anandasangaree","Gary Anandasangaree","Liberal","Scarborough—Guildwood—Rouge Park","ON"],
  ["gerard-deltell","Gérard Deltell","Conservative","Louis-Saint-Laurent—Akiawenhrahk","QC"],
  ["ginette-lavack","Ginette Lavack","Liberal","St. Boniface—St. Vital","MB"],
  ["ginette-petitpas-taylor","Ginette Petitpas Taylor","Liberal","Moncton—Dieppe","NB"],
  ["giovanna-mingarelli","Giovanna Mingarelli","Liberal","Prescott—Russell—Cumberland","ON"],
  ["glen-motz","Glen Motz","Conservative","Medicine Hat—Cardston—Warner","AB"],
  ["gord-johns","Gord Johns","NDP","Courtenay—Alberni","BC"],
  ["grant-jackson","Grant Jackson","Conservative","Brandon—Souris","MB"],
  ["greg-fergus","Greg Fergus","Liberal","Hull—Aylmer","QC"],
  ["greg-mclean","Greg McLean","Conservative","Calgary Centre","AB"],
  ["gregor-robertson","Gregor Robertson","Liberal","Vancouver Fraserview—South Burnaby","BC"],
  ["guillaume-deschenes-theriault","Guillaume Deschênes-Thériault","Liberal","Madawaska—Restigouche","NB"],
  ["gurbux-saini","Gurbux Saini","Liberal","Fleetwood—Port Kells","BC"],
  ["harb-gill","Harb Gill","Conservative","Windsor West","ON"],
  ["heath-macdonald","Heath MacDonald","Liberal","Malpeque","PE"],
  ["heather-mcpherson","Heather McPherson","NDP","Edmonton Strathcona","AB"],
  ["hedy-fry","Hedy Fry","Liberal","Vancouver Centre","BC"],
  ["helena-jaczek","Helena Jaczek","Liberal","Markham—Stouffville","ON"],
  ["helena-konanz","Helena Konanz","Conservative","Similkameen—South Okanagan—West Kootenay","BC"],
  ["iqra-khalid","Iqra Khalid","Liberal","Mississauga—Erin Mills","ON"],
  ["iqwinder-gaheer","Iqwinder Gaheer","Liberal","Mississauga—Malton","ON"],
  ["jacob-mantle","Jacob Mantle","Conservative","York—Durham","ON"],
  ["jacques-gourde","Jacques Gourde","Conservative","Lévis—Lotbinière","QC"],
  ["jacques-ramsay","Jacques Ramsay","Liberal","La Prairie—Atateken","QC"],
  ["jagsharan-singh-mahal","Jagsharan Singh Mahal","Conservative","Edmonton Southeast","AB"],
  ["jaime-battiste","Jaime Battiste","Liberal","Cape Breton—Canso—Antigonish","NS"],
  ["jake-sawatzky","Jake Sawatzky","Liberal","New Westminster—Burnaby—Maillardville","BC"],
  ["james-bezan","James Bezan","Conservative","Selkirk—Interlake—Eastman","MB"],
  ["james-maloney","James Maloney","Liberal","Etobicoke—Lakeshore","ON"],
  ["jamie-schmale","Jamie Schmale","Conservative","Haliburton—Kawartha Lakes","ON"],
  ["jamil-jivani","Jamil Jivani","Conservative","Bowmanville—Oshawa North","ON"],
  ["jason-groleau","Jason Groleau","Conservative","Beauce","QC"],
  ["jasraj-singh-hallan","Jasraj Singh Hallan","Conservative","Calgary East","AB"],
  ["jean-denis-garon","Jean-Denis Garon","Bloc","Mirabel","QC"],
  ["jean-yip","Jean Yip","Liberal","Scarborough—Agincourt","ON"],
  ["jean-yves-duclos","Jean-Yves Duclos","Liberal","Québec Centre","QC"],
  ["jeff-kibble","Jeff Kibble","Conservative","Cowichan—Malahat—Langford","BC"],
  ["jenna-sudds","Jenna Sudds","Liberal","Kanata","ON"],
  ["jennifer-mckelvie","Jennifer McKelvie","Liberal","Ajax","ON"],
  ["jenny-kwan","Jenny Kwan","NDP","Vancouver East","BC"],
  ["jeremy-patzer","Jeremy Patzer","Conservative","Swift Current—Grasslands—Kindersley","SK"],
  ["jessica-fancy-landry","Jessica Fancy-Landry","Liberal","South Shore—St. Margarets","NS"],
  ["jill-mcknight","Jill McKnight","Liberal","Delta","BC"],
  ["jim-belanger","Jim Belanger","Conservative","Sudbury East—Manitoulin—Nickel Belt","ON"],
  ["joanne-thompson","Joanne Thompson","Liberal","St. John's East","NL"],
  ["joel-godin","Joël Godin","Conservative","Portneuf—Jacques-Cartier","QC"],
  ["joel-lightbound","Joël Lightbound","Liberal","Louis-Hébert","QC"],
  ["john-barlow","John Barlow","Conservative","Foothills","AB"],
  ["john-brassard","John Brassard","Conservative","Barrie South—Innisfil","ON"],
  ["john-nater","John Nater","Conservative","Perth—Wellington","ON"],
  ["john-paul-danko","John-Paul Danko","Liberal","Hamilton West—Ancaster—Dundas","ON"],
  ["john-williamson","John Williamson","Conservative","Saint John—St. Croix","NB"],
  ["john-zerucelli","John Zerucelli","Liberal","Etobicoke North","ON"],
  ["jonathan-rowe","Jonathan Rowe","Conservative","Terra Nova—The Peninsulas","NL"],
  ["juanita-nathan","Juanita Nathan","Liberal","Pickering—Brooklin","ON"],
  ["judy-sgro","Judy Sgro","Liberal","Humber River—Black Creek","ON"],
  ["julie-dabrusin","Julie Dabrusin","Liberal","Toronto—Danforth","ON"],
  ["julie-dzerowicz","Julie Dzerowicz","Liberal","Davenport","ON"],
  ["karim-bardeesy","Karim Bardeesy","Liberal","Taiaiako'n—Parkdale—High Park","ON"],
  ["karina-gould","Karina Gould","Liberal","Burlington","ON"],
  ["kathy-borrelli","Kathy Borrelli","Conservative","Windsor—Tecumseh—Lakeshore","ON"],
  ["kelly-block","Kelly Block","Conservative","Carlton Trail—Eagle Creek","SK"],
  ["kelly-deridder","Kelly DeRidder","Conservative","Kitchener Centre","ON"],
  ["kelly-mccauley","Kelly McCauley","Conservative","Edmonton West","AB"],
  ["kent-macdonald","Kent MacDonald","Liberal","Cardigan","PE"],
  ["kerry-diotte","Kerry Diotte","Conservative","Edmonton Griesbach","AB"],
  ["kevin-lamoureux","Kevin Lamoureux","Liberal","Winnipeg North","MB"],
  ["kevin-waugh","Kevin Waugh","Conservative","Saskatoon South","SK"],
  ["kody-blois","Kody Blois","Liberal","Kings—Hants","NS"],
  ["kristina-tesser","Kristina Tesser Derksen","Liberal","Milton East—Halton Hills South","ON"],
  ["kurt-holman","Kurt Holman","Conservative","London—Fanshawe","ON"],
  ["kyle-seeback","Kyle Seeback","Conservative","Dufferin—Caledon","ON"],
  ["laila-goodridge","Laila Goodridge","Conservative","Fort McMurray—Cold Lake","AB"],
  ["leah-gazan","Leah Gazan","NDP","Winnipeg Centre","MB"],
  ["lena-metlege-diab","Lena Metlege Diab","Liberal","Halifax West","NS"],
  ["leslie-church","Leslie Church","Liberal","Toronto—St. Paul's","ON"],
  ["leslyn-lewis","Leslyn Lewis","Conservative","Haldimand—Norfolk","ON"],
  ["lianne-rood","Lianne Rood","Conservative","Middlesex—London","ON"],
  ["linda-lapointe","Linda Lapointe","Liberal","Rivière-des-Mille-Îles","QC"],
  ["lisa-hepfner","Lisa Hepfner","Liberal","Hamilton Mountain","ON"],
  ["lori-idlout","Lori Idlout","Liberal","Nunavut","NU"],
  ["louis-plamondon","Louis Plamondon","Bloc","Bécancour—Nicolet—Saurel—Alnôbak","QC"],
  ["louis-villeneuve","Louis Villeneuve","Liberal","Brome—Missisquoi","QC"],
  ["luc-berthold","Luc Berthold","Conservative","Mégantic—L’Érable—Lotbinière","QC"],
  ["luc-theriault","Luc Thériault","Bloc","Montcalm","QC"],
  ["madeleine-chenette","Madeleine Chenette","Liberal","Thérèse-De Blainville","QC"],
  ["maggie-chi","Maggie Chi","Liberal","Don Valley North","ON"],
  ["mandy-gull-masty","Mandy Gull-Masty","Liberal","Abitibi—Baie-James—Nunavik—Eeyou","QC"],
  ["maninder-sidhu","Maninder Sidhu","Liberal","Brampton East","ON"],
  ["marc-dalton","Marc Dalton","Conservative","Pitt Meadows—Maple Ridge","BC"],
  ["marc-miller","Marc Miller","Liberal","Ville-Marie—Le Sud-Ouest—Île-des-Soeurs","QC"],
  ["marcus-powlowski","Marcus Powlowski","Liberal","Thunder Bay—Rainy River","ON"],
  ["marianne-dandurand","Marianne Dandurand","Liberal","Compton—Stanstead","QC"],
  ["marie-france-lalonde","Marie-France Lalonde","Liberal","Orléans","ON"],
  ["marie-gabrielle-menard","Marie-Gabrielle Ménard","Liberal","Hochelaga—Rosemont-Est","QC"],
  ["marie-helene-gaudreau","Marie-Hélène Gaudreau","Bloc","Laurentides—Labelle","QC"],
  ["marilene-gill","Marilène Gill","Bloc","Côte-Nord—Kawawachikamach—Nitassinan","QC"],
  ["marilyn-gladu","Marilyn Gladu","Liberal","Sarnia—Lambton—Bkejwanong","ON"],
  ["mario-beaulieu","Mario Beaulieu","Bloc","La Pointe-de-l'Île","QC"],
  ["mario-simard","Mario Simard","Bloc","Jonquière","QC"],
  ["marjorie-michel","Marjorie Michel","Liberal","Papineau","QC"],
  ["mark-carney","Mark Carney","Liberal","Nepean","ON"],
  ["mark-gerretsen","Mark Gerretsen","Liberal","Kingston and the Islands","ON"],
  ["mark-strahl","Mark Strahl","Conservative","Chilliwack—Hope","BC"],
  ["martin-champoux","Martin Champoux","Bloc","Drummond","QC"],
  ["matt-jeneroux","Matt Jeneroux","Liberal","Edmonton Riverbend","AB"],
  ["matt-strauss","Matt Strauss","Conservative","Kitchener South—Hespeler","ON"],
  ["maxime-blanchette-joncas","Maxime Blanchette-Joncas","Bloc","Rimouski—La Matapédia","QC"],
  ["mel-arnold","Mel Arnold","Conservative","Kamloops—Shuswap—Central Rockies","BC"],
  ["melanie-joly","Mélanie Joly","Liberal","Ahuntsic-Cartierville","QC"],
  ["melissa-lantsman","Melissa Lantsman","Conservative","Thornhill","ON"],
  ["michael-barrett","Michael Barrett","Conservative","Leeds—Grenville—Thousand Islands—Rideau Lakes","ON"],
  ["michael-chong","Michael Chong","Conservative","Wellington—Halton Hills North","ON"],
  ["michael-cooper","Michael Cooper","Conservative","St. Albert—Sturgeon River","AB"],
  ["michael-coteau","Michael Coteau","Liberal","Scarborough—Woburn","ON"],
  ["michael-guglielmin","Michael Guglielmin","Conservative","Vaughan—Woodbridge","ON"],
  ["michael-kram","Michael Kram","Conservative","Regina—Wascana","SK"],
  ["michael-ma","Michael Ma","Liberal","Markham—Unionville","ON"],
  ["michelle-rempel","Michelle Rempel","Conservative","Calgary Nose Hill","AB"],
  ["mike-dawson","Mike Dawson","Conservative","Miramichi—Grand Lake","NB"],
  ["mike-kelloway","Mike Kelloway","Liberal","Sydney—Glace Bay","NS"],
  ["mike-lake","Mike Lake","Conservative","Leduc—Wetaskiwin","AB"],
  ["mona-fortier","Mona Fortier","Liberal","Ottawa—Vanier—Gloucester","ON"],
  ["nathalie-provost","Nathalie Provost","Liberal","Châteauguay—Les Jardins-de-Napierville","QC"],
  ["natilien-joseph","Natilien Joseph","Liberal","Longueuil—Saint-Hubert","QC"],
  ["ned-kuruc","Ned Kuruc","Conservative","Hamilton East—Stoney Creek","ON"],
  ["parm-bains","Parm Bains","Liberal","Richmond East—Steveston","BC"],
  ["pat-kelly","Pat Kelly","Conservative","Calgary Crowfoot","AB"],
  ["patricia-lattanzio","Patricia Lattanzio","Liberal","Saint-Léonard—Saint-Michel","QC"],
  ["patrick-bonin","Patrick Bonin","Bloc","Repentigny","QC"],
  ["patrick-weiler","Patrick Weiler","Liberal","West Vancouver—Sunshine Coast—Sea to Sky Country","BC"],
  ["patty-hajdu","Patty Hajdu","Liberal","Thunder Bay—Superior North","ON"],
  ["paul-connors","Paul Connors","Liberal","Avalon","NL"],
  ["pauline-rochefort","Pauline Rochefort","Liberal","Nipissing—Timiskaming","ON"],
  ["peter-fonseca","Peter Fonseca","Liberal","Mississauga East—Cooksville","ON"],
  ["peter-fragiskatos","Peter Fragiskatos","Liberal","London Centre","ON"],
  ["peter-schiefke","Peter Schiefke","Liberal","Vaudreuil","QC"],
  ["philip-earle","Philip Earle","Liberal","Labrador","NL"],
  ["philip-lawrence","Philip Lawrence","Conservative","Northumberland—Clarke","ON"],
  ["pierre-paul-hus","Pierre Paul-Hus","Conservative","Charlesbourg—Haute-Saint-Charles","QC"],
  ["pierre-poilievre","Pierre Poilievre","Conservative","Battle River—Crowfoot","AB"],
  ["rachael-harder","Rachael Thomas","Conservative","Lethbridge","AB"],
  ["rachel-bendayan","Rachel Bendayan","Liberal","Outremont","QC"],
  ["randeep-sarai","Randeep Sarai","Liberal","Surrey Centre","BC"],
  ["randy-hoback","Randy Hoback","Conservative","Prince Albert","SK"],
  ["raquel-dancho","Raquel Dancho","Conservative","Kildonan—St. Paul","MB"],
  ["rebecca-alty","Rebecca Alty","Liberal","Northwest Territories","NT"],
  ["rebecca-chartrand","Rebecca Chartrand","Liberal","Churchill—Keewatinook Aski","MB"],
  ["rechie-valdez","Rechie Valdez","Liberal","Mississauga—Streetsville","ON"],
  ["rheal-fortin","Rhéal Fortin","Bloc","Rivière-du-Nord","QC"],
  ["rhonda-kirkland","Rhonda Kirkland","Conservative","Oshawa","ON"],
  ["richard-bragdon","Richard Bragdon","Conservative","Tobique—Mactaquac","NB"],
  ["rob-moore","Rob Moore","Conservative","Fundy Royal","NB"],
  ["rob-morrison","Rob Morrison","Conservative","Columbia—Kootenay—Southern Rockies","BC"],
  ["rob-oliphant","Rob Oliphant","Liberal","Don Valley West","ON"],
  ["roman-baber","Roman Baber","Conservative","York Centre","ON"],
  ["ron-mckinnon","Ron McKinnon","Liberal","Coquitlam—Port Coquitlam","BC"],
  ["rosemarie-falk","Rosemarie Falk","Conservative","Battlefords—Lloydminster—Meadow Lake","SK"],
  ["ruby-sahota","Ruby Sahota","Liberal","Brampton North—Caledon","ON"],
  ["ryan-turnbull","Ryan Turnbull","Liberal","Whitby","ON"],
  ["salma-zahid","Salma Zahid","Liberal","Scarborough Centre—Don Valley East","ON"],
  ["sameer-zuberi","Sameer Zuberi","Liberal","Pierrefonds—Dollard","QC"],
  ["sandra-cobena","Sandra Cobena","Conservative","Newmarket—Aurora","ON"],
  ["scot-davidson","Scot Davidson","Conservative","New Tecumseth—Gwillimbury","ON"],
  ["scott-aitchison","Scott Aitchison","Conservative","Parry Sound—Muskoka","ON"],
  ["scott-anderson","Scott Anderson","Conservative","Vernon—Lake Country—Monashee","BC"],
  ["scott-reid","Scott Reid","Conservative","Lanark—Frontenac","ON"],
  ["sean-casey","Sean Casey","Liberal","Charlottetown","PE"],
  ["sean-fraser","Sean Fraser","Liberal","Central Nova","NS"],
  ["sebastien-lemire","Sébastien Lemire","Bloc","Abitibi—Témiscamingue","QC"],
  ["serge-cormier","Serge Cormier","Liberal","Acadie—Bathurst","NB"],
  ["shafqat-ali","Shafqat Ali","Liberal","Brampton—Chinguacousy Park","ON"],
  ["shannon-miedema","Shannon Miedema","Liberal","Halifax","NS"],
  ["shannon-stubbs","Shannon Stubbs","Conservative","Lakeland","AB"],
  ["shelby-kramp-neuman","Shelby Kramp-Neuman","Conservative","Hastings—Lennox and Addington—Tyendinaga","ON"],
  ["sherry-romanado","Sherry Romanado","Liberal","Longueuil—Charles-LeMoyne","QC"],
  ["shuv-majumdar","Shuv Majumdar","Conservative","Calgary Heritage","AB"],
  ["sima-acan","Sima Acan","Liberal","Oakville West","ON"],
  ["sonia-sidhu","Sonia Sidhu","Liberal","Brampton South","ON"],
  ["sophie-chatel","Sophie Chatel","Liberal","Pontiac—Kitigan Zibi","QC"],
  ["steeve-lavoie","Steeve Lavoie","Liberal","Beauport—Limoilou","QC"],
  ["stephane-lauzon","Stéphane Lauzon","Liberal","Argenteuil—La Petite-Nation","QC"],
  ["stephanie-kusie","Stephanie Kusie","Conservative","Calgary Midnapore","AB"],
  ["stephanie-mclean","Stephanie McLean","Liberal","Esquimalt—Saanich—Sooke","BC"],
  ["stephen-fuhr","Stephen Fuhr","Liberal","Kelowna","BC"],
  ["steven-bonk","Steven Bonk","Conservative","Souris—Moose Mountain","SK"],
  ["steven-mackinnon","Steven MacKinnon","Liberal","Gatineau","QC"],
  ["sukh-dhaliwal","Sukh Dhaliwal","Liberal","Surrey Newton","BC"],
  ["sukhman-gill","Sukhman Gill","Conservative","Abbotsford—South Langley","BC"],
  ["tako-van-popta","Tako Van Popta","Conservative","Langley Township—Fraser Heights","BC"],
  ["taleeb-noormohamed","Taleeb Noormohamed","Liberal","Vancouver Granville","BC"],
  ["tamara-jansen","Tamara Jansen","Conservative","Cloverdale—Langley City","BC"],
  ["tamara-kronis","Tamara Kronis","Conservative","Nanaimo—Ladysmith","BC"],
  ["tanveer-shahnawaz","Tanveer Shahnawaz","Liberal","Beaches—East York","ON"],
  ["tatiana-auguste","Tatiana Auguste","Liberal","Terrebonne","QC"],
  ["ted-falk","Ted Falk","Conservative","Provencher","MB"],
  ["terry-beech","Terry Beech","Liberal","Burnaby North—Seymour","BC"],
  ["terry-dowdall","Terry Dowdall","Conservative","Simcoe—Grey","ON"],
  ["terry-duguid","Terry Duguid","Liberal","Winnipeg South","MB"],
  ["terry-sheehan","Terry Sheehan","Liberal","Sault Ste. Marie—Algoma","ON"],
  ["tim-hodgson","Tim Hodgson","Liberal","Markham—Thornhill","ON"],
  ["tim-louis","Tim Louis","Liberal","Kitchener—Conestoga","ON"],
  ["tim-uppal","Tim Uppal","Conservative","Edmonton Gateway","AB"],
  ["tim-watchorn","Tim Watchorn","Liberal","Les Pays-d'en-Haut","QC"],
  ["todd-doherty","Todd Doherty","Conservative","Cariboo—Prince George","BC"],
  ["tom-kmiec","Tom Kmiec","Conservative","Calgary Shepard","AB"],
  ["tom-osborne","Tom Osborne","Liberal","Cape Spear","NL"],
  ["tony-baldinelli","Tony Baldinelli","Conservative","Niagara Falls—Niagara-on-the-Lake","ON"],
  ["vince-gasparro","Vince Gasparro","Liberal","Eglinton—Lawrence","ON"],
  ["vincent-ho","Vincent Ho","Conservative","Richmond Hill South","ON"],
  ["viviane-lapointe","Viviane LaPointe","Liberal","Sudbury","ON"],
  ["wade-chang","Wade Chang","Liberal","Burnaby Central","BC"],
  ["wade-grant","Wade Grant","Liberal","Vancouver Quadra","BC"],
  ["warren-steinley","Warren Steinley","Conservative","Regina—Lewvan","SK"],
  ["wayne-long","Wayne Long","Liberal","Saint John—Kennebecasis","NB"],
  ["will-greaves","Will Greaves","Liberal","Victoria","BC"],
  ["william-stevenson","William Stevenson","Conservative","Yellowhead","AB"],
  ["xavier-barsalou-duval","Xavier Barsalou-Duval","Bloc","Pierre-Boucher—Les Patriotes—Verchères","QC"],
  ["yasir-naqvi","Yasir Naqvi","Liberal","Ottawa Centre","ON"],
  ["yvan-baker","Yvan Baker","Liberal","Etobicoke Centre","ON"],
  ["yves-francois-blanchet","Yves-François Blanchet","Bloc","Beloeil—Chambly","QC"],
  ["yves-perron","Yves Perron","Bloc","Berthier—Maskinongé","QC"],
  ["ziad-aboultaif","Ziad Aboultaif","Conservative","Edmonton Manning","AB"],
  ["zoe-royer","Zoe Royer","Liberal","Port Moody—Coquitlam","BC"],
]

// /votes/45-1/177/: ballots in QA_MPS order. Y yes, N no, P paired, D didn't vote.
const QA_BALLOTS_177 =
  "YNYNNNYNNNNNYYNYYNNNNNYNNNYYNNNYDNYYYYNYYNNYNNNYNYNYNYNNNYNYNNNYYYNYYYYYYYNNNYYN" +
  "YNYNNNYYNYNNYYNDYYYNNNNNDNYYYYNYYNYNNNYYYNPNNNYNYPNYNNYYNYNNYNYYYYNNNYNNYYNNYNYN" +
  "YYYNYNYNNNNNNYYYYYYNYNNYYYYNNYYNNNNNYNNNNNYNNNNNNNYNNNNNYNNYNYNYYYYPYYNPYNYNNNYN" +
  "YNNNNNNNNNNYYYYNNYYNNNNYYYYPYNYNNNNYYYYYNNNNNNYYNYNNNNNPNNYNNYYNYYNNYNYNNNNYNYYN" +
  "YNYNNNYNNYNNNNNYN"

const QA_VOTE_177 = {
  "url": "/votes/45-1/177/",
  "session": "45-1",
  "number": 177,
  "date": "2026-10-07",
  "description": {
    "en": "2nd reading of Bill C-218, An Act to amend the Criminal Code (medical assistance in dying)",
    "fr": "2e lecture du projet de loi C-218, Loi modifiant le Code criminel (aide médicale à mourir)"
  },
  "result": "Failed",
  "yea_total": 141,
  "nay_total": 187,
  "paired_total": 6,
  "bill_url": "/bills/45-1/C-218/",
  "party_votes": [
    {
      "vote": "Yes",
      "disagreement": 0,
      "party": {
        "name": {
          "en": "Conservative Party of Canada"
        },
        "short_name": {
          "en": "Conservative"
        }
      }
    },
    {
      "vote": "No",
      "disagreement": 0.011904761904761904,
      "party": {
        "name": {
          "en": "Liberal Party of Canada"
        },
        "short_name": {
          "en": "Liberal"
        }
      }
    },
    {
      "vote": "No",
      "disagreement": 0,
      "party": {
        "name": {
          "en": "Bloc Québécois"
        },
        "short_name": {
          "en": "Bloc"
        }
      }
    },
    {
      "vote": "Yes",
      "disagreement": 0,
      "party": {
        "name": {
          "en": "New Democratic Party"
        },
        "short_name": {
          "en": "NDP"
        }
      }
    },
    {
      "vote": "Yes",
      "disagreement": 0,
      "party": {
        "name": {
          "en": "Green Party of Canada"
        },
        "short_name": {
          "en": "Green"
        }
      }
    }
  ]
} as const

// /votes/45-1/178/: ballots in QA_MPS order. Y yes, N no, P paired, D didn't vote.
const QA_BALLOTS_178 =
  "YYYYYYYYNNYYYYNYYYPYYYYYYYYYYYYYPYYYYYYYYYYYYYYYYYYYYYYYYYYYNNYYYYYYYYYYYYYYYYYY" +
  "YYYYYYYNYYYYNYYYYYYYYYYYDYDYYYNYYYYYYYYNYYPYYYYYNPYYYYYYYYYYYYYDYYNYYYYYNYYYYYYY" +
  "YYYYYYYYYYYYYYYYYYYYYYYYYYNYYYYYYYDYYNYYYYYYYYYYNNYNNYYYYNYYNYYYYYYPYYYPYYYYYYYY" +
  "YYNYYYYYYYYPYYDYPYYYYYNYYYYPYYYYYYYYYYYYYYNYYYYYYYYYYYYPYYYYYYYYYYYYYYYYYYYYYYYY" +
  "YYYYYYYYYYNYYNNYY"

const QA_VOTE_178 = {
  "url": "/votes/45-1/178/",
  "session": "45-1",
  "number": 178,
  "date": "2026-10-08",
  "description": {
    "en": "2nd reading of Bill C-39, An Act respecting certain measures to strengthen the economy",
    "fr": "2e lecture du projet de loi C-39, Loi concernant certaines mesures visant à renforcer l'économie"
  },
  "result": "Passed",
  "yea_total": 296,
  "nay_total": 26,
  "paired_total": 10,
  "bill_url": "/bills/45-1/C-39/",
  "party_votes": [
    {
      "vote": "Yes",
      "disagreement": 0,
      "party": {
        "name": {
          "en": "Conservative Party of Canada"
        },
        "short_name": {
          "en": "Conservative"
        }
      }
    },
    {
      "vote": "Yes",
      "disagreement": 0,
      "party": {
        "name": {
          "en": "Liberal Party of Canada"
        },
        "short_name": {
          "en": "Liberal"
        }
      }
    },
    {
      "vote": "No",
      "disagreement": 0,
      "party": {
        "name": {
          "en": "Bloc Québécois"
        },
        "short_name": {
          "en": "Bloc"
        }
      }
    },
    {
      "vote": "No",
      "disagreement": 0,
      "party": {
        "name": {
          "en": "New Democratic Party"
        },
        "short_name": {
          "en": "NDP"
        }
      }
    },
    {
      "vote": "No",
      "disagreement": 0,
      "party": {
        "name": {
          "en": "Green Party of Canada"
        },
        "short_name": {
          "en": "Green"
        }
      }
    }
  ]
} as const

const QA_BILL_C_39 = {
  "url": "/bills/45-1/C-39/",
  "session": "45-1",
  "number": "C-39",
  "name": {
    "en": "An Act respecting certain measures to strengthen the economy",
    "fr": "Loi concernant certaines mesures visant à renforcer l'économie"
  },
  "short_title": {
    "en": "Building Canada Strong Act",
    "fr": "Loi visant à bâtir un Canada fort"
  },
  "introduced": "2026-09-21",
  "law": null,
  "status_code": "HouseInCommittee",
  "legisinfo_url": "https://www.parl.ca/legisinfo/en/bill/45-1/C-39",
  "sponsor_politician_url": "/politicians/steven-mackinnon/",
  "private_member_bill": false,
  "home_chamber": "House",
  "status": {
    "en": "In committee (House)"
  },
  "text_url": "https://www.parl.ca/DocumentViewer/en/14226813"
} as const

const QA_BILL_C_218 = {
  "url": "/bills/45-1/C-218/",
  "session": "45-1",
  "number": "C-218",
  "name": {
    "en": "An Act to amend the Criminal Code (medical assistance in dying)",
    "fr": "Loi modifiant le Code criminel (aide médicale à mourir)"
  },
  "short_title": {
    "en": "",
    "fr": ""
  },
  "introduced": "2025-06-20",
  "law": null,
  "status_code": "BillDefeated",
  "legisinfo_url": "https://www.parl.ca/legisinfo/en/bill/45-1/C-218",
  "sponsor_politician_url": "/politicians/tamara-jansen/",
  "private_member_bill": true,
  "home_chamber": "House",
  "status": {
    "en": "Defeated"
  },
  "text_url": "https://www.parl.ca/DocumentViewer/en/13575177"
} as const

// Run only when executed directly, so mint-session.ts can import the identities. Kept last so
// the data constants above are initialised before main() reads them.
if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`seed-local failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
