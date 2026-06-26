import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import {
  RepublicDocument,
  RepublicPage,
} from '../primitives'
import { colors, type as typeScale, space } from '../styles'

const styles = StyleSheet.create({
  // Sender block
  senderBlock: {
    marginBottom: 24,
    fontSize: typeScale.bodyLarge,
    lineHeight: 1.5,
  },
  senderName: {
    fontWeight: 600,
  },

  // Date
  dateBlock: {
    marginBottom: 24,
    fontSize: typeScale.bodyLarge,
  },

  // Addressee
  addresseeBlock: {
    marginBottom: 24,
    fontSize: typeScale.bodyLarge,
    lineHeight: 1.5,
  },

  // Reference line
  referenceLine: {
    fontWeight: 600,
    fontSize: typeScale.bodyLarge,
    marginBottom: 24,
    lineHeight: 1.45,
  },

  // Salutation
  salutation: {
    marginBottom: 18,
    fontSize: typeScale.bodyLarge,
  },

  // Body paragraph
  bodyParagraph: {
    marginBottom: 12,
    fontSize: typeScale.bodyLarge,
    lineHeight: 1.65,
  },

  // Records list
  recordsList: {
    marginVertical: 12,
    marginLeft: 24,
  },
  recordItem: {
    paddingLeft: 24,
    marginBottom: 8,
    lineHeight: 1.55,
    fontSize: typeScale.bodyLarge,
  },
  recordNumber: {
    position: 'absolute' as const,
    left: 0,
    fontWeight: 600,
    fontSize: typeScale.bodyLarge,
  },

  // Closing
  closing: {
    marginTop: 24,
    fontSize: typeScale.bodyLarge,
  },

  // Signature line
  signatureLine: {
    marginTop: 48,
    width: 200,
    borderTopWidth: 1,
    borderTopColor: colors.text,
    paddingTop: 6,
    lineHeight: 1.5,
  },
  signaturePlaceholder: {
    color: colors.muted,
    fontStyle: 'italic' as const,
    fontSize: typeScale.subHeading,
  },

  // Footer wordmark
  footerWordmark: {
    marginTop: 80,
    textAlign: 'center' as const,
    fontFamily: 'Instrument Sans',
    fontWeight: 800,
    fontSize: 7,
    letterSpacing: 1.4,
    color: colors.border,
  },
})

/**
 * Lever action data for FIPPA request.
 * Content is plain text -- we parse heading/paragraph structure.
 */
interface FippaRequestData {
  title: string
  content: string
  metadata?: Record<string, unknown>
}

export function FippaRequestTemplate({ data }: { data: FippaRequestData }) {
  const date = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Parse the content into sections
  const sections = parseFippaContent(data.content)
  const publicBody = (data.metadata?.publicBody as string) ?? ''
  const jurisdiction = (data.metadata?.jurisdictionName as string) ?? ''

  return (
    <RepublicDocument title={data.title}>
      <RepublicPage serif>
        {/* Sender block */}
        <View style={styles.senderBlock}>
          <Text style={styles.senderName}>[YOUR NAME]</Text>
          <Text>[YOUR ADDRESS]</Text>
          <Text>[CITY, PROVINCE, POSTAL CODE]</Text>
          <Text>[EMAIL ADDRESS]</Text>
          <Text>[PHONE NUMBER]</Text>
        </View>

        {/* Date */}
        <Text style={styles.dateBlock}>{date}</Text>

        {/* Addressee */}
        <View style={styles.addresseeBlock}>
          <Text>Freedom of Information Coordinator</Text>
          {publicBody ? (
            <Text>{publicBody}</Text>
          ) : jurisdiction ? (
            <Text>{jurisdiction}</Text>
          ) : (
            <Text>[Public Body Name]</Text>
          )}
          <Text>[Address]</Text>
        </View>

        {/* Reference line */}
        <Text style={styles.referenceLine}>
          Re: {data.title}
        </Text>

        {/* Body content */}
        {sections.salutation && (
          <Text style={styles.salutation}>{sections.salutation}</Text>
        )}

        {sections.paragraphs.map((para, i) => (
          <Text key={i} style={styles.bodyParagraph}>
            {para}
          </Text>
        ))}

        {/* Records requested */}
        {sections.records.length > 0 && (
          <View style={styles.recordsList}>
            {sections.records.map((record, i) => (
              <View key={i} style={styles.recordItem} wrap={false}>
                <Text style={styles.recordNumber}>{i + 1}.</Text>
                <Text>{record}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Remaining paragraphs after records */}
        {sections.closingParagraphs.map((para, i) => (
          <Text key={i} style={styles.bodyParagraph}>
            {para}
          </Text>
        ))}

        {/* Closing */}
        <Text style={styles.closing}>Yours sincerely,</Text>

        {/* Signature */}
        <View style={styles.signatureLine}>
          <Text style={styles.signaturePlaceholder}>[YOUR NAME]</Text>
          <Text style={styles.signaturePlaceholder}>[YOUR ADDRESS]</Text>
        </View>

        {/* Wordmark */}
        <Text style={styles.footerWordmark}>OPEN CAVE</Text>
      </RepublicPage>
    </RepublicDocument>
  )
}

/**
 * Parse FIPPA request plain text into structured sections.
 * The content generated by the Lever follows a standard structure:
 * salutation, introductory paragraphs, numbered records, closing paragraphs.
 */
interface ParsedFippa {
  salutation: string
  paragraphs: string[]
  records: string[]
  closingParagraphs: string[]
}

function parseFippaContent(content: string): ParsedFippa {
  const lines = content.split('\n').filter((l) => l.trim())
  const result: ParsedFippa = {
    salutation: '',
    paragraphs: [],
    records: [],
    closingParagraphs: [],
  }

  let phase: 'pre' | 'body' | 'records' | 'post' = 'pre'

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect salutation
    if (phase === 'pre' && (trimmed.startsWith('Dear ') || trimmed.startsWith('To '))) {
      result.salutation = trimmed
      phase = 'body'
      continue
    }

    // If no salutation found, move to body
    if (phase === 'pre') {
      phase = 'body'
    }

    // Detect numbered record items (1. or 1) or bullet points)
    const isNumbered = /^\d+[\.\)]/.test(trimmed)

    if (isNumbered && phase !== 'post') {
      phase = 'records'
      result.records.push(trimmed.replace(/^\d+[\.\)]\s*/, ''))
      continue
    }

    // After records section, remaining paragraphs are closing
    if (phase === 'records' && !isNumbered) {
      phase = 'post'
    }

    if (phase === 'body') {
      result.paragraphs.push(trimmed)
    } else if (phase === 'post') {
      // Skip sign-off lines
      if (trimmed === 'Yours sincerely,' || trimmed === 'Sincerely,' || trimmed.startsWith('[YOUR')) {
        continue
      }
      result.closingParagraphs.push(trimmed)
    }
  }

  return result
}
