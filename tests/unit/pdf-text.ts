/**
 * Test helpers: read a rendered PDF back with pdfjs-dist (text items with
 * their geometry, per page) and rasterise it with pdftoppm. Shared by the
 * FIPPA and campaign PDF tests. Not a test file itself.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

export interface PdfItem {
  str: string
  /** Left edge, points from the page's left edge. */
  x: number
  /** Right edge. */
  right: number
  /** Baseline, points from the page's bottom edge. */
  baseline: number
  /** Glyph box bottom and top (baseline -/+ descender/ascender), points from the bottom edge. */
  bottom: number
  top: number
}

export interface PdfPage {
  width: number
  height: number
  items: PdfItem[]
  /** Every item's string, in content order, concatenated. */
  text: string
}

export interface PdfRead {
  pages: PdfPage[]
  info: Record<string, unknown>
}

export async function readPdf(buf: Uint8Array): Promise<PdfRead> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise
  const pages: PdfPage[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const [, , width, height] = page.view
    const content = await page.getTextContent()
    const items: PdfItem[] = []
    for (const raw of content.items) {
      if (!('str' in raw)) continue
      const size = Math.hypot(raw.transform[2], raw.transform[3])
      const font = content.styles[raw.fontName] as { ascent?: number; descent?: number } | undefined
      const ascent = font?.ascent ?? 1
      const descent = font?.descent ?? -0.3
      const x = raw.transform[4]
      const baseline = raw.transform[5]
      items.push({
        str: raw.str,
        x,
        right: x + raw.width,
        baseline,
        bottom: baseline + descent * size,
        top: baseline + ascent * size,
      })
    }
    pages.push({ width, height, items, text: items.map((i) => i.str).join('') })
  }
  const meta = await doc.getMetadata()
  await doc.destroy()
  return { pages, info: (meta.info ?? {}) as Record<string, unknown> }
}

/** All whitespace removed: PDF line wrapping is layout, not content (A4 text oracle). */
export const squash = (s: string) => s.replace(/\s+/g, '')

export const PAGE_LABEL = /^Page (\d+) of (\d+)$/

export function hasPdftoppm(): boolean {
  return spawnSync('pdftoppm', ['-v'], { stdio: 'ignore' }).status === 0
}

export interface Raster {
  width: number
  height: number
  /** RGB, 3 bytes per pixel. */
  data: Buffer
  /** Pixels per point. */
  scale: number
}

/** Rasterise every page at `dpi` with pdftoppm (PPM output, read directly). */
export function rasterise(buf: Uint8Array, dpi = 50): Raster[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-pdf-raster-'))
  try {
    const file = path.join(dir, 'in.pdf')
    fs.writeFileSync(file, buf)
    execFileSync('pdftoppm', ['-r', String(dpi), file, path.join(dir, 'p')])
    const out = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ppm'))
      .sort((a, b) => Number(a.match(/(\d+)\.ppm$/)![1]) - Number(b.match(/(\d+)\.ppm$/)![1]))
    return out.map((f) => parsePpm(fs.readFileSync(path.join(dir, f)), dpi / 72))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function parsePpm(b: Buffer, scale: number): Raster {
  // P6\n<w> <h>\n<max>\n<binary>
  let at = 0
  const tokens: string[] = []
  while (tokens.length < 4) {
    while (/\s/.test(String.fromCharCode(b[at]))) at++
    if (b[at] === 0x23) {
      while (b[at] !== 0x0a) at++
      continue
    }
    let t = ''
    while (!/\s/.test(String.fromCharCode(b[at]))) t += String.fromCharCode(b[at++])
    tokens.push(t)
  }
  at++ // the single whitespace after maxval
  if (tokens[0] !== 'P6' || tokens[3] !== '255') throw new Error(`unexpected PPM header ${tokens.join(' ')}`)
  const width = Number(tokens[1])
  const height = Number(tokens[2])
  return { width, height, data: b.subarray(at, at + width * height * 3), scale }
}

/**
 * Pixels that are not pure white (#FFFFFF) outside every text item's glyph
 * box (baseline-relative, descender to ascender), each expanded by `padPx`.
 */
export function nonWhiteOutsideText(r: Raster, page: PdfPage, padPx = 2): { x: number; y: number; rgb: number[] }[] {
  const masked = new Uint8Array(r.width * r.height)
  for (const it of page.items) {
    if (!it.str) continue
    const x0 = Math.floor(it.x * r.scale) - padPx
    const x1 = Math.ceil(it.right * r.scale) + padPx
    const y0 = Math.floor((page.height - it.top) * r.scale) - padPx
    const y1 = Math.ceil((page.height - it.bottom) * r.scale) + padPx
    for (let y = Math.max(0, y0); y <= Math.min(r.height - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(r.width - 1, x1); x++) masked[y * r.width + x] = 1
    }
  }
  const bad: { x: number; y: number; rgb: number[] }[] = []
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      if (masked[y * r.width + x]) continue
      const o = (y * r.width + x) * 3
      if (r.data[o] !== 255 || r.data[o + 1] !== 255 || r.data[o + 2] !== 255) {
        bad.push({ x, y, rgb: [r.data[o], r.data[o + 1], r.data[o + 2]] })
      }
    }
  }
  return bad
}

/** Drain a Node readable stream to a Buffer. */
export async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  return Buffer.concat(chunks)
}
