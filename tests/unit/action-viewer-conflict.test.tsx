// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { createHash } from 'node:crypto'

/*
 * The Lever viewer (A4): the §3 recipient notices and the "Insert directory
 * address" button, and the editor's side of the §4 compare-and-set: every
 * write carries the baseline hash, a 409 is worded by its reason, and the
 * citizen's text is never discarded.
 *
 * The component is rendered for real. Only its network is replaced, by a
 * small in-memory server with PATCH's own rules: a write lands only when the
 * stored text still hashes to the client's `expectedContentSha256` (the
 * server's hash is node:crypto over UTF-8, independent of the viewer's Web
 * Crypto), and its 409 bodies are the route's exact strings.
 */

import { ActionViewer } from '@/components/lever/action-viewer'
import { MARKER_V1_LETTER, PLACEHOLDER_LETTER, AI_STUB_LETTERS } from '../fixtures/letters'

const ID = '44444444-4444-4444-8444-444444444444'
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

// The route's 409 bodies, written out here rather than imported.
const NOT_A_DRAFT = 'This letter is no longer a draft'
const CONTENT_CHANGED = 'This letter changed since you opened it'
const STATUS_CHANGED = "This letter's status changed since you opened it. Reload to see it."
const UNCLEAN_SPLIT = "Remove the notes that aren't part of your request before you finalise."

const CHECK = "Check the recipient before you send. Open Cave doesn't confirm it for you."
const FOI_OPS = 'FOI Operations, PO Box 9569, Stn Prov Govt, Victoria BC V8W 9K1'
const LISTED_NOT_FOUND = `Open Cave's directory lists BC Ministry of Forests's FOI address as ${FOI_OPS} (checked 2026-10-12). We couldn't find that address in your letter.`
const NO_CHECKED =
  'Open Cave has no checked address for this body. Find its FOI contact on its own website and confirm it before you send.'
const EAO_UNCHECKED =
  "Open Cave hasn't checked an FOI address for BC Environmental Assessment Office. Find it on BC Environmental Assessment Office's own website and confirm it before you send."

/** A FIPPA letter for BC Ministry of Forests with the address placeholder (and a bracket in the guidance). */
const FORESTS_PLACEHOLDER = [
  'Dear FOI Coordinator,',
  'BC Ministry of Forests',
  '[Public body FOI address]',
  '',
  'I request the 2025 inspection reports.',
  '=== NOT PART OF YOUR REQUEST ===',
  'Leave [Public body FOI address] alone here.',
].join('\n')

interface Row {
  content: string
  status: 'draft' | 'final' | 'filed'
  metadata: Record<string, unknown>
}

interface ServerPlan {
  row: Row
  /** Forced PATCH answer (status and error), instead of the rules. */
  patch409?: string
  /** PATCH waits for this before answering. */
  patchGate?: Promise<void>
  /** The generate response: text streamed, and what the row holds after. */
  generate?: { status?: number; error?: string; streamed?: string; storedAfter?: string; metadataAfter?: Record<string, unknown> }
  /** GET fails (re-read after a stream). */
  getFails?: boolean
  exportStatus?: number
  exportError?: string
}

let plan: ServerPlan
let patches: Array<Record<string, unknown>>
let generates: number

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installServer(p: ServerPlan) {
  plan = p
  patches = []
  generates = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url === `/api/lever/actions/${ID}` && method === 'GET') {
        if (plan.getFails) return json({ error: 'nope' }, 500)
        return json({ action: { id: ID, ...plan.row } })
      }
      if (url === `/api/lever/actions/${ID}` && method === 'PATCH') {
        const body = JSON.parse(String(init!.body)) as Record<string, unknown>
        patches.push(body)
        if (plan.patchGate) await plan.patchGate
        if (plan.patch409) return json({ error: plan.patch409 }, 409)
        if (body.expectedContentSha256 !== sha(plan.row.content)) return json({ error: CONTENT_CHANGED }, 409)
        if (typeof body.content === 'string') plan.row.content = body.content
        if (typeof body.status === 'string') plan.row.status = body.status as Row['status']
        if (typeof body.jurisdiction === 'string') plan.row.metadata = { ...plan.row.metadata, jurisdiction: body.jurisdiction }
        return json({ action: { id: ID, status: plan.row.status, content: plan.row.content } })
      }
      if (url === '/api/lever/generate') {
        generates++
        const g = plan.generate ?? {}
        if (g.status && g.status !== 200) return json({ error: g.error }, g.status)
        if (g.storedAfter !== undefined) plan.row.content = g.storedAfter
        if (g.metadataAfter) plan.row.metadata = { ...plan.row.metadata, ...g.metadataAfter }
        return new Response(g.streamed ?? '', { status: 200 })
      }
      if (url === '/api/lever/export') {
        if (plan.exportStatus && plan.exportStatus !== 200) return json({ error: plan.exportError }, plan.exportStatus)
        return new Response('%PDF-', { status: 200 })
      }
      throw new Error(`unexpected fetch ${method} ${url}`)
    })
  )
}

function renderViewer(opts: {
  content: string
  status?: Row['status']
  metadata?: Record<string, unknown>
  investigationProvince?: 'bc' | 'ab' | 'on' | null
}) {
  const metadata = opts.metadata ?? {}
  installServer({ row: { content: opts.content, status: opts.status ?? 'draft', metadata }, ...(plan_extra ?? {}) })
  plan_extra = null
  return render(
    <ActionViewer
      actionId={ID}
      initialContent={opts.content}
      initialStatus={opts.status ?? 'draft'}
      actionType="fippa_request"
      letterFormat={metadata.letterFormat}
      recipientMetadata={{
        publicBody: metadata.publicBody,
        publicBodyName: metadata.publicBodyName,
        addressee: metadata.addressee,
        jurisdiction: metadata.jurisdiction,
      }}
      investigationProvince={opts.investigationProvince ?? null}
    />
  )
}

/** Extra server behaviour for the next renderViewer call. */
let plan_extra: Partial<ServerPlan> | null = null

const FORESTS_BC = { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc', letterFormat: 'marker-v1' }
const notice = () => document.querySelector('[data-recipient-notice]')
const noticeLines = () => Array.from(notice()?.querySelectorAll('p') ?? []).map((p) => p.textContent)
const insertButton = () => document.querySelector('[data-insert-address]') as HTMLButtonElement | null
const textarea = () => screen.getByLabelText('Edit document text') as HTMLTextAreaElement

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// The §3 recipient notices
// ---------------------------------------------------------------------------

describe('recipient notices (filings §3)', () => {
  it('checked, address not in the letter (an old ministry box): listed, "couldn\'t find", never a confirmation (Razor N4)', () => {
    renderViewer({ content: MARKER_V1_LETTER.content, metadata: FORESTS_BC })
    expect(noticeLines()).toEqual([CHECK, LISTED_NOT_FOUND])
    expect(notice()!.textContent).not.toMatch(/\b(verified|confirmed|is correct)\b/i)
    expect(insertButton()).toBeNull()
    // The notice is outside the letter; the letter keeps its own box.
    expect(document.querySelector('[data-letter-paper]')!.textContent).toContain('PO Box 9049')
    expect(document.querySelector('[data-letter-paper]')!.textContent).not.toContain(CHECK)
  })

  it('checked, address in the letter: only the unconditional line', () => {
    renderViewer({ content: `Dear FOI Coordinator,\n${FOI_OPS}\n\nI request the records.`, metadata: { ...FORESTS_BC, letterFormat: undefined } })
    expect(noticeLines()).toEqual([CHECK])
  })

  it('the investigation\'s province resolves a body with no stored province', () => {
    renderViewer({ content: MARKER_V1_LETTER.content, metadata: { publicBody: 'BC Ministry of Forests', letterFormat: 'marker-v1' }, investigationProvince: 'bc' })
    expect(noticeLines()).toEqual([CHECK, LISTED_NOT_FOUND])
  })

  it('checked with the placeholder on a draft: the insert button', () => {
    renderViewer({ content: FORESTS_PLACEHOLDER, metadata: FORESTS_BC })
    expect(noticeLines()).toEqual([CHECK, LISTED_NOT_FOUND])
    expect(insertButton()!.textContent).toBe('Insert directory address')
  })

  it.each(['final', 'filed'] as const)('checked with the placeholder on a %s letter: no insert button', (status) => {
    renderViewer({ content: FORESTS_PLACEHOLDER, metadata: FORESTS_BC, status })
    expect(noticeLines()[0]).toBe(CHECK)
    expect(insertButton()).toBeNull()
  })

  it('unchecked (EAO) with the placeholder on a draft: the unchecked line, no address, no button', () => {
    renderViewer({ content: PLACEHOLDER_LETTER.content, metadata: { publicBody: 'BC Environmental Assessment Office', jurisdiction: 'bc', letterFormat: 'marker-v1' } })
    expect(noticeLines()).toEqual([CHECK, EAO_UNCHECKED])
    expect(insertButton()).toBeNull()
    expect(notice()!.textContent).not.toContain('9426')
  })

  it('other (a body not in the directory): no checked address, no button', () => {
    renderViewer({ content: FORESTS_PLACEHOLDER, metadata: { publicBody: 'Synthetic Test Authority (QA)', jurisdiction: 'bc', letterFormat: 'marker-v1' } })
    expect(noticeLines()).toEqual([CHECK, NO_CHECKED])
    expect(insertButton()).toBeNull()
  })

  it('unresolved (no province anywhere): no checked address, no button, and no BC entry borrowed', () => {
    renderViewer({ content: FORESTS_PLACEHOLDER, metadata: { publicBody: 'BC Ministry of Forests', letterFormat: 'marker-v1' } })
    expect(noticeLines()).toEqual([CHECK, NO_CHECKED])
    expect(insertButton()).toBeNull()
  })

  it('insert: one PATCH of the letter part only, with the baseline hash; the notice then updates', async () => {
    renderViewer({ content: FORESTS_PLACEHOLDER, metadata: FORESTS_BC })
    fireEvent.click(insertButton()!)
    await waitFor(() => expect(insertButton()).toBeNull())
    expect(patches).toHaveLength(1)
    expect(patches[0]).toEqual({
      // Postal lines only, municipality on its own line (Jen C7).
      content: FORESTS_PLACEHOLDER.replace('[Public body FOI address]\n', 'PO Box 9569, Stn Prov Govt\nVictoria BC V8W 9K1\n'),
      expectedContentSha256: sha(FORESTS_PLACEHOLDER),
    })
    // The guidance's bracket is untouched.
    expect(String(patches[0].content)).toContain('Leave [Public body FOI address] alone here.')
    expect(String(patches[0].content)).not.toContain('FOI Operations')
    expect(noticeLines()).toEqual([CHECK])
    // Said, not silent (Jen C8).
    expect(screen.getByRole('status').textContent).toBe(
      'Inserted the directory address into your letter. Check it before you send.'
    )
  })

  it('busy, never disabled: Insert and Save keep focus while their write is in flight (Jen C8)', async () => {
    let open!: () => void
    plan_extra = { patchGate: new Promise<void>((r) => (open = r)) }
    renderViewer({ content: FORESTS_PLACEHOLDER, metadata: FORESTS_BC })
    const insert = insertButton()!
    insert.focus()
    fireEvent.click(insert)
    await waitFor(() => expect(insert.getAttribute('aria-busy')).toBe('true'))
    expect(insert.hasAttribute('disabled')).toBe(false)
    expect(insert.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(insert)
    fireEvent.click(insert)
    open()
    await waitFor(() => expect(insertButton()).toBeNull())
    expect(patches).toHaveLength(1)

    let release!: () => void
    plan.patchGate = new Promise<void>((r) => (release = r))
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.change(textarea(), { target: { value: 'Edited.' } })
    const save = screen.getByText('Save').closest('button')!
    save.focus()
    fireEvent.click(save)
    await waitFor(() => expect(save.getAttribute('aria-busy')).toBe('true'))
    expect(save.hasAttribute('disabled')).toBe(false)
    expect(document.activeElement).toBe(save)
    release()
    await waitFor(() => expect(screen.queryByLabelText('Edit document text')).toBeNull())
  })

  it('insert that loses to another write: a 409 worded for a stale view, and nothing changes', async () => {
    plan_extra = { patch409: CONTENT_CHANGED }
    renderViewer({ content: FORESTS_PLACEHOLDER, metadata: FORESTS_BC })
    fireEvent.click(insertButton()!)
    await screen.findByText('This letter changed since you opened it. Reload to see it.')
    expect(document.querySelector('[data-letter-paper]')!.textContent).toContain('[Public body FOI address]')
  })
})

// ---------------------------------------------------------------------------
// The editor's compare-and-set (filings §4)
// ---------------------------------------------------------------------------

describe('the editor and 409s (filings §4)', () => {
  it('a save sends the hash of the content exactly as the API returned it, CRLF and all, and is not a conflict', async () => {
    const crlf = 'Dear FOI Coordinator,\r\n\r\nI request the records.'
    renderViewer({ content: crlf })
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.change(textarea(), { target: { value: 'Dear FOI Coordinator,\n\nI request the records.' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(screen.queryByLabelText('Edit document text')).toBeNull())
    expect(patches[0].expectedContentSha256).toBe(sha(crlf))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('saving twice without reloading re-baselines on what was stored: never a conflict', async () => {
    renderViewer({ content: 'First text.' })
    for (const next of ['Second text.', 'Third text.']) {
      fireEvent.click(screen.getByText('Edit'))
      fireEvent.change(textarea(), { target: { value: next } })
      fireEvent.click(screen.getByText('Save'))
      await waitFor(() => expect(screen.queryByLabelText('Edit document text')).toBeNull())
    }
    expect(patches.map((p) => p.expectedContentSha256)).toEqual([sha('First text.'), sha('Second text.')])
    expect(plan.row.content).toBe('Third text.')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a save that loses to another write keeps the citizen\'s text in the textarea and says so', async () => {
    renderViewer({ content: 'Server text.' })
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.change(textarea(), { target: { value: 'My careful edit.' } })
    plan.row.content = 'Someone else saved this meanwhile.'
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This letter changed while you were editing. Your text is still here; copy it, then reload.'
    )
    expect(textarea().value).toBe('My careful edit.')
  })

  it('a save on a letter finalised elsewhere keeps the text and says it is no longer a draft', async () => {
    plan_extra = { patch409: NOT_A_DRAFT }
    renderViewer({ content: 'Server text.' })
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.change(textarea(), { target: { value: 'My careful edit.' } })
    fireEvent.click(screen.getByText('Save'))
    expect((await screen.findByRole('alert')).textContent).toBe(
      "This letter is no longer a draft, so it can't be changed. Your text is still here; copy it, then reload."
    )
    expect(textarea().value).toBe('My careful edit.')
  })

  it('finalise sends the hash; an unclean split is refused with the route\'s message and nothing changes', async () => {
    plan_extra = { patch409: UNCLEAN_SPLIT }
    renderViewer({ content: AI_STUB_LETTERS['missing-marker'], metadata: { letterFormat: 'marker-v1' } })
    fireEvent.click(screen.getByText('Mark as Final'))
    expect((await screen.findByRole('alert')).textContent).toBe(UNCLEAN_SPLIT)
    expect(patches[0]).toEqual({ status: 'final', expectedContentSha256: sha(AI_STUB_LETTERS['missing-marker']) })
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByText('Edit')).toBeTruthy()
  })

  it('a status change that lost to another tab says so', async () => {
    plan_extra = { patch409: STATUS_CHANGED }
    renderViewer({ content: 'Text.' })
    fireEvent.click(screen.getByText('Mark as Final'))
    expect((await screen.findByRole('alert')).textContent).toBe(STATUS_CHANGED)
  })

  it('an invalid transition from a stale view reads as a status change, never developer text (Jen C2)', async () => {
    plan_extra = { patch409: 'Invalid status transition: filed → final' }
    renderViewer({ content: 'Text.' })
    fireEvent.click(screen.getByText('Mark as Final'))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(STATUS_CHANGED)
    expect(alert.textContent).not.toContain('→')
  })

  it('a finalise of text this tab never displayed is a conflict, worded for a stale view', async () => {
    renderViewer({ content: 'What this tab shows.' })
    plan.row.content = 'What another tab saved.'
    fireEvent.click(screen.getByText('Mark as Final'))
    expect((await screen.findByRole('alert')).textContent).toBe('This letter changed since you opened it. Reload to see it.')
    expect(plan.row.status).toBe('draft')
  })

  it('filing sends the hash too', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderViewer({ content: 'Final text.', status: 'final' })
    fireEvent.click(screen.getByText('Mark as Filed'))
    await screen.findByText('Filed')
    expect(patches[0]).toEqual({ status: 'filed', expectedContentSha256: sha('Final text.') })
  })
})

// ---------------------------------------------------------------------------
// Generation: the re-read, and the province choice
// ---------------------------------------------------------------------------

describe('generation (A2 carry)', () => {
  it('after the stream ends the stored text is re-read; if it differs, it is shown and said', async () => {
    plan_extra = {
      generate: { streamed: 'Streamed text.', storedAfter: AI_STUB_LETTERS['marker-v1'], metadataAfter: { letterFormat: 'marker-v1' } },
    }
    renderViewer({ content: '' })
    expect(await screen.findByText('A newer version was saved. Showing that one.')).toBeTruthy()
    // The stored marker-v1 text, split by the format the generation recorded.
    expect(document.querySelector('[data-letter-guidance]')).not.toBeNull()
    expect(document.querySelector('[data-letter-paper]')!.textContent).not.toContain('Streamed text.')
    // And the next write is baselined on that stored text.
    fireEvent.click(screen.getByText('Mark as Final'))
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0].expectedContentSha256).toBe(sha(AI_STUB_LETTERS['marker-v1']))
  })

  it('when the stored text is what streamed, nothing is said', async () => {
    plan_extra = { generate: { streamed: 'Same text.', storedAfter: 'Same text.' } }
    renderViewer({ content: '' })
    await screen.findByText('Same text.')
    expect(screen.queryByText('A newer version was saved. Showing that one.')).toBeNull()
  })

  it('a failed re-read is shown, not swallowed', async () => {
    plan_extra = { generate: { streamed: 'Text.', storedAfter: 'Text.' }, getFails: true }
    renderViewer({ content: '' })
    expect((await screen.findByRole('alert')).textContent).toBe("The saved letter couldn't be reloaded. Reload the page to see it.")
  })

  it('"Choose the province" offers BC, AB and ON, stores the choice through PATCH, then generates', async () => {
    plan_extra = { generate: { status: 409, error: 'Choose the province this request goes to' } }
    renderViewer({ content: '', metadata: { publicBody: 'Synthetic Test Authority (QA)' } })
    const panel = (await waitFor(() => {
      const el = document.querySelector('[data-province-choice]')
      expect(el).not.toBeNull()
      return el
    })) as HTMLElement
    const select = within(panel).getByRole('combobox') as HTMLSelectElement
    await waitFor(() => expect(document.activeElement).toBe(select))
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'bc', 'ab', 'on'])
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      'Choose a province...',
      'British Columbia',
      'Alberta (not verified)',
      'Ontario (not verified)',
    ])
    plan.generate = { streamed: 'Generated.', storedAfter: 'Generated.' }
    fireEvent.change(select, { target: { value: 'bc' } })
    fireEvent.click(within(panel).getByRole('button'))
    await screen.findByText('Generated.')
    expect(patches).toEqual([{ jurisdiction: 'bc', expectedContentSha256: sha('') }])
    expect(generates).toBe(2)
    expect(document.querySelector('[data-province-choice]')).toBeNull()
  })

  it('a listed body: the province is confirmed, not chosen, with why, and focus lands on it (Razor N5, Jen C9)', async () => {
    plan_extra = { generate: { status: 409, error: 'Choose the province this request goes to' } }
    renderViewer({ content: '', metadata: { publicBody: 'BC Ministry of Forests' } })
    const panel = (await waitFor(() => {
      const el = document.querySelector('[data-province-choice]')
      expect(el).not.toBeNull()
      return el
    })) as HTMLElement
    expect(within(panel).queryByRole('combobox')).toBeNull()
    expect(panel.textContent).toContain('Confirm the province this request goes to.')
    expect(panel.querySelector('[data-province-reason]')!.textContent).toBe(
      'BC Ministry of Forests is in the British Columbia directory, so this request goes to British Columbia. For another province, start a new request.'
    )
    const go = within(panel).getByRole('button')
    expect(go.textContent).toBe('Generate for British Columbia')
    await waitFor(() => expect(document.activeElement).toBe(go))
    expect(screen.getByText('No letter yet. Choose the province above to generate it.')).toBeTruthy()
    plan.generate = { streamed: 'Generated.', storedAfter: 'Generated.' }
    fireEvent.click(go)
    await screen.findByText('Generated.')
    expect(patches).toEqual([{ jurisdiction: 'bc', expectedContentSha256: sha('') }])
  })

  it('a draft stranded in the wrong province gets the choice back, for its body\'s province only (Razor N5)', async () => {
    const refusal =
      'This request names BC Ministry of Forests, which is in the British Columbia directory, but it goes to Alberta. Start a new request with the right province.'
    plan_extra = { generate: { status: 409, error: refusal } }
    renderViewer({ content: '', metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'ab' } })
    expect((await screen.findByRole('alert')).textContent).toBe(refusal)
    const panel = document.querySelector('[data-province-choice]') as HTMLElement
    expect(within(panel).queryByRole('combobox')).toBeNull()
    plan.generate = { streamed: 'Generated.', storedAfter: 'Generated.' }
    fireEvent.click(within(panel).getByRole('button', { name: 'Generate for British Columbia' }))
    await screen.findByText('Generated.')
    expect(patches).toEqual([{ jurisdiction: 'bc', expectedContentSha256: sha('') }])
    expect(plan.row.metadata.jurisdiction).toBe('bc')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a 409 that is not about the province never offers the choice', async () => {
    plan_extra = { generate: { status: 409, error: 'This letter is no longer a draft' } }
    renderViewer({ content: '', metadata: { publicBody: 'BC Ministry of Forests', jurisdiction: 'bc' } })
    expect((await screen.findByRole('alert')).textContent).toBe('This letter is no longer a draft')
    expect(document.querySelector('[data-province-choice]')).toBeNull()
  })

  it('Re-generate is offered on drafts only', () => {
    renderViewer({ content: 'Text.', status: 'final' })
    expect(screen.queryByText('Re-generate')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// PDF timeout
// ---------------------------------------------------------------------------

describe('Export: a PDF that ran out of time', () => {
  it('shows the 503\'s message and downloads nothing', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    plan_extra = { exportStatus: 503, exportError: "The PDF couldn't be made right now. Use Print or Plain text instead." }
    renderViewer({ content: 'Text.' })
    fireEvent.click(screen.getByText('Export'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'PDF' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      "The PDF couldn't be made right now. Use Print or Plain text instead."
    )
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
