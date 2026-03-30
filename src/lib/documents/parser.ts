import 'server-only'
import { PDFParse } from 'pdf-parse'

export interface ParseResult {
  text: string
  pageCount: number
  wordCount: number
  extractionQuality: 'high' | 'low'
}

export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })

  // Get text content from all pages
  const textResult = await parser.getText()
  await parser.destroy()

  const text = textResult.text ?? ''
  const pageCount = textResult.total ?? textResult.pages.length ?? 1
  const wordCount = text.split(/\s+/).filter(Boolean).length

  // Heuristic: if average words per page < 50, likely a scanned PDF
  const avgWordsPerPage = pageCount > 0 ? wordCount / pageCount : 0
  const extractionQuality: 'high' | 'low' = avgWordsPerPage < 50 ? 'low' : 'high'

  return { text, pageCount, wordCount, extractionQuality }
}
