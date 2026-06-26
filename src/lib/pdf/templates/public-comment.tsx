import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import {
  RepublicDocument,
  RepublicPage,
} from '../primitives'
import { colors, type as typeScale, space } from '../styles'

const styles = StyleSheet.create({
  // Running header
  runningHeader: {
    fontSize: typeScale.footnote,
    fontWeight: 500,
    color: colors.muted,
    letterSpacing: 0.16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    marginBottom: 28,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },

  // Docket reference
  docketLabel: {
    fontFamily: 'Instrument Sans',
    fontWeight: 800,
    fontSize: typeScale.small,
    letterSpacing: 0.72,
    color: colors.muted,
    marginBottom: 4,
  },
  docketId: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: 16,
    color: colors.text,
    lineHeight: 1.3,
    marginBottom: 20,
  },

  // Date and addressee
  dateLine: {
    fontSize: typeScale.subHeading,
    marginBottom: 18,
    color: colors.text,
  },
  addressee: {
    marginBottom: 18,
    lineHeight: 1.5,
    fontSize: typeScale.subHeading,
  },

  // Section reference headers
  sectionRef: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.subHeading,
    color: colors.text,
    marginTop: 22,
    marginBottom: 14,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Numbered body paragraphs
  bodyParagraph: {
    marginBottom: 14,
    paddingLeft: 36,
    fontSize: typeScale.subHeading,
    lineHeight: 1.6,
  },
  paraNum: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: typeScale.subHeading,
    color: colors.muted,
    width: 28,
    textAlign: 'right' as const,
  },

  // Recommendations box
  recommendations: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginVertical: 24,
    backgroundColor: 'rgba(200, 91, 91, 0.04)',
  },
  recsHeader: {
    fontFamily: 'Instrument Sans',
    fontWeight: 800,
    fontSize: typeScale.subHeading,
    letterSpacing: 1.1,
    color: colors.accent,
    marginBottom: 14,
  },
  recItem: {
    paddingLeft: 28,
    marginBottom: 10,
    fontSize: typeScale.subHeading,
    lineHeight: 1.55,
    fontWeight: 500,
  },
  recNumber: {
    position: 'absolute' as const,
    left: 0,
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    color: colors.accent,
    fontSize: typeScale.subHeading,
  },

  // Closing / Signature
  closing: {
    marginTop: 24,
    lineHeight: 1.5,
    fontSize: typeScale.subHeading,
  },
  closingRespectfully: {
    marginTop: 18,
    fontSize: typeScale.subHeading,
  },
  signatureLine: {
    marginTop: 36,
    width: 200,
    borderTopWidth: 1,
    borderTopColor: colors.text,
    paddingTop: 6,
  },
  signaturePlaceholder: {
    color: colors.muted,
    fontStyle: 'italic' as const,
    fontSize: typeScale.bodySmall,
  },

  // Footer
  footer: {
    marginTop: 40,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  footerText: {
    fontSize: typeScale.micro,
    color: colors.footerText,
  },
  footerWordmark: {
    fontFamily: 'Instrument Sans',
    fontWeight: 800,
    fontSize: 7,
    letterSpacing: 1.05,
    color: colors.borderFaint,
  },
})

interface PublicCommentData {
  title: string
  content: string
  metadata?: Record<string, unknown>
}

export function PublicCommentTemplate({ data }: { data: PublicCommentData }) {
  const date = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const sections = parsePublicCommentContent(data.content)
  const publicBody = (data.metadata?.publicBody as string) ?? ''

  return (
    <RepublicDocument title={data.title}>
      <RepublicPage>
        {/* Running header */}
        <View style={styles.runningHeader}>
          <Text>Submission by [Name] -- {data.title}</Text>
        </View>

        {/* Docket reference */}
        <Text style={styles.docketLabel}>PUBLIC COMMENT</Text>
        <Text style={styles.docketId}>Re: {data.title}</Text>

        {/* Date */}
        <Text style={styles.dateLine}>{date}</Text>

        {/* Addressee */}
        <View style={styles.addressee}>
          {publicBody ? (
            <Text>{publicBody}</Text>
          ) : (
            <>
              <Text>Municipal Clerk</Text>
              <Text>[Public Body]</Text>
            </>
          )}
        </View>

        {/* Body paragraphs */}
        {sections.map((section, si) => (
          <React.Fragment key={si}>
            {section.heading && (
              <Text style={styles.sectionRef}>{section.heading}</Text>
            )}
            {section.paragraphs.map((para, pi) => (
              <View key={pi} style={styles.bodyParagraph} wrap={false}>
                <Text style={styles.paraNum}>{para.number}.</Text>
                <Text>{para.text}</Text>
              </View>
            ))}
          </React.Fragment>
        ))}

        {/* Recommendations */}
        {sections.length > 0 && extractRecommendations(data.content).length > 0 && (
          <View style={styles.recommendations} wrap={false}>
            <Text style={styles.recsHeader}>RECOMMENDATIONS</Text>
            {extractRecommendations(data.content).map((rec, i) => (
              <View key={i} style={styles.recItem}>
                <Text style={styles.recNumber}>{i + 1}.</Text>
                <Text>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Closing */}
        <View style={styles.closing}>
          <Text>
            Thank you for the opportunity to provide comments. I am available to address any questions at the public hearing.
          </Text>
          <Text style={styles.closingRespectfully}>Respectfully submitted,</Text>
        </View>

        {/* Signature */}
        <View style={styles.signatureLine}>
          <Text style={styles.signaturePlaceholder}>[YOUR NAME]</Text>
          <Text style={styles.signaturePlaceholder}>[YOUR ADDRESS]</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated from Open Cave -- opencave.ca
          </Text>
          <Text style={styles.footerText}>{date}</Text>
        </View>
      </RepublicPage>
    </RepublicDocument>
  )
}

// -------------------------------------------------------------------
// Content parser
// -------------------------------------------------------------------

interface ParsedSection {
  heading: string | null
  paragraphs: { number: number; text: string }[]
}

function parsePublicCommentContent(content: string): ParsedSection[] {
  const lines = content.split('\n')
  const sections: ParsedSection[] = []
  let currentSection: ParsedSection = { heading: null, paragraphs: [] }
  let paraNumber = 1

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Skip address blocks, salutations, and sign-off lines
    if (
      trimmed.startsWith('Dear ') ||
      trimmed.startsWith('To ') ||
      trimmed.startsWith('[YOUR') ||
      trimmed === 'Respectfully submitted,' ||
      trimmed === 'Sincerely,' ||
      trimmed === 'Yours sincerely,'
    ) {
      continue
    }

    // Detect section headers (lines that look like headings)
    // Heuristic: short lines with no period at end, or lines starting with "Section" / "Re:"
    const isHeading =
      (trimmed.length < 80 && !trimmed.endsWith('.') && !trimmed.endsWith(',') && trimmed.includes('--')) ||
      trimmed.startsWith('Section ') ||
      trimmed.startsWith('Re:') ||
      (trimmed.length < 60 && trimmed === trimmed.replace(/[.!?]$/, ''))

    if (isHeading && trimmed.length < 80 && currentSection.paragraphs.length > 0) {
      sections.push(currentSection)
      currentSection = { heading: trimmed, paragraphs: [] }
      continue
    }

    // Strip existing numbering
    const stripped = trimmed.replace(/^\d+[\.\)]\s*/, '')
    currentSection.paragraphs.push({ number: paraNumber, text: stripped })
    paraNumber++
  }

  if (currentSection.paragraphs.length > 0) {
    sections.push(currentSection)
  }

  return sections
}

function extractRecommendations(content: string): string[] {
  const recs: string[] = []
  const lower = content.toLowerCase()
  const recIdx = lower.indexOf('recommend')

  if (recIdx === -1) return recs

  // Get content after "recommendations" heading
  const after = content.slice(recIdx)
  const lines = after.split('\n')

  // Skip the heading line itself
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue

    // Stop at sign-off
    if (
      trimmed.startsWith('Thank you') ||
      trimmed.startsWith('Respectfully') ||
      trimmed.startsWith('Sincerely') ||
      trimmed.startsWith('[YOUR')
    ) {
      break
    }

    // Numbered or bulleted items
    const stripped = trimmed.replace(/^[\d\-\*\)\.]+\s*/, '')
    if (stripped) recs.push(stripped)
  }

  return recs
}
