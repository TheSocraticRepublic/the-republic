import { StyleSheet } from '@react-pdf/renderer'

// -------------------------------------------------------------------
// Design tokens — matched to the HTML template designs
// -------------------------------------------------------------------

export const colors = {
  bg: '#fafaf9',
  text: '#1c1917',
  textSecondary: '#44403c',
  textMuted: '#57534e',
  muted: '#78716c',
  border: '#e7e5e4',
  borderLight: '#f5f5f4',
  borderFaint: '#d6d3d1',
  accent: '#C85B5B',       // Lever red
  accentBg: 'rgba(200, 91, 91, 0.06)',
  accentBgSubtle: 'rgba(200, 91, 91, 0.04)',
  mirror: '#5BC88A',       // Mirror green
  mirrorBg: 'rgba(91, 200, 138, 0.08)',
  oracle: '#89B4C8',       // Oracle blue
  gadfly: '#C8A84B',       // Gadfly amber
  footerText: '#a8a29e',
  wordmark: '#d6d3d1',
  // Darker accent tones for text on light backgrounds
  accentDark: '#b04a4a',
} as const

// -------------------------------------------------------------------
// Typography scale (points)
// -------------------------------------------------------------------

export const type = {
  title: 24,
  headline: 23,
  sectionHeading: 14,
  subHeading: 11,
  bodyLarge: 12,
  body: 10.5,
  bodySmall: 10,
  small: 9,
  footnote: 8,
  micro: 7.5,
  wordmark: 9,
} as const

// -------------------------------------------------------------------
// Spacing system (points)
// -------------------------------------------------------------------

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  pageMargin: 72, // 1 inch = 72pt
  pageMarginLandscape: 54, // 0.75in
} as const

// -------------------------------------------------------------------
// Shared styles — reusable across templates
// -------------------------------------------------------------------

export const shared = StyleSheet.create({
  // Page defaults
  page: {
    fontFamily: 'Inter',
    fontSize: type.body,
    lineHeight: 1.55,
    color: colors.text,
    backgroundColor: colors.bg,
    paddingTop: space.pageMargin,
    paddingBottom: space.pageMargin,
    paddingHorizontal: space.pageMargin,
  },

  pageLandscape: {
    fontFamily: 'Inter',
    fontSize: type.bodySmall,
    lineHeight: 1.5,
    color: colors.text,
    backgroundColor: colors.bg,
    paddingTop: space.pageMarginLandscape,
    paddingBottom: space.pageMarginLandscape,
    paddingHorizontal: space.pageMarginLandscape,
  },

  // Serif page for legal documents
  pageSerif: {
    fontFamily: 'Source Serif 4',
    fontSize: type.bodyLarge,
    lineHeight: 1.65,
    color: colors.text,
    backgroundColor: colors.bg,
    paddingTop: space.pageMargin,
    paddingBottom: space.pageMargin,
    paddingHorizontal: space.pageMargin,
  },

  // 4px accent band at top of page
  accentBand: {
    height: 4,
    backgroundColor: colors.accent,
    marginBottom: 28,
    marginHorizontal: -space.pageMargin,
    marginTop: -space.pageMargin,
  },

  // Wordmark
  wordmark: {
    fontFamily: 'Instrument Sans',
    fontWeight: 800,
    fontSize: type.wordmark,
    letterSpacing: 1.8, // ~0.2em at 9pt
    color: colors.wordmark,
    marginBottom: space.xl,
  },

  wordmarkSubtle: {
    fontFamily: 'Instrument Sans',
    fontWeight: 800,
    fontSize: type.wordmark,
    letterSpacing: 1.8,
    color: colors.wordmark,
    marginBottom: space.sm,
  },

  // Section heading with bottom border
  sectionHeading: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: type.sectionHeading,
    color: colors.text,
    marginTop: space.xxxl,
    marginBottom: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Smaller section header (uppercase, muted)
  sectionLabel: {
    fontFamily: 'Instrument Sans',
    fontWeight: 700,
    fontSize: type.subHeading,
    letterSpacing: 0.44, // ~0.04em at 11pt
    color: colors.muted,
    marginBottom: space.md,
    marginTop: space.xl,
  },

  // Body text paragraph
  bodyText: {
    fontSize: type.body,
    lineHeight: 1.55,
    marginBottom: space.md,
  },

  // Footer
  footer: {
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },

  footerText: {
    fontSize: type.micro,
    color: colors.footerText,
  },

  footerWordmark: {
    fontFamily: 'Instrument Sans',
    fontWeight: 800,
    fontSize: 7,
    letterSpacing: 1.05,
    color: colors.borderFaint,
  },

  // Sources section
  sourcesContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.md,
    marginTop: space.lg,
  },

  sourcesHeader: {
    fontFamily: 'Instrument Sans',
    fontWeight: 600,
    fontSize: type.footnote,
    letterSpacing: 0.64, // ~0.08em
    color: colors.muted,
    marginBottom: 6,
  },

  sourceItem: {
    fontSize: type.footnote,
    color: colors.muted,
    lineHeight: 1.6,
    marginBottom: 2,
    paddingLeft: space.lg,
  },
})
