import { Font } from '@react-pdf/renderer'

// Register fonts from Google Fonts GitHub repo (variable TTF files).
// @react-pdf/renderer resolves these at render time.
// Using the raw GitHub URLs for the variable-weight TTF files.

const GOOGLE_FONTS_BASE = 'https://github.com/google/fonts/raw/main'

Font.register({
  family: 'Plus Jakarta Sans',
  fonts: [
    {
      src: `${GOOGLE_FONTS_BASE}/ofl/plusjakartasans/static/PlusJakartaSans-SemiBold.ttf`,
      fontWeight: 600,
    },
    {
      src: `${GOOGLE_FONTS_BASE}/ofl/plusjakartasans/static/PlusJakartaSans-Bold.ttf`,
      fontWeight: 700,
    },
    {
      src: `${GOOGLE_FONTS_BASE}/ofl/plusjakartasans/static/PlusJakartaSans-ExtraBold.ttf`,
      fontWeight: 800,
    },
  ],
})

Font.register({
  family: 'Inter',
  fonts: [
    {
      src: `${GOOGLE_FONTS_BASE}/ofl/inter/static/Inter_18pt-Regular.ttf`,
      fontWeight: 400,
    },
    {
      src: `${GOOGLE_FONTS_BASE}/ofl/inter/static/Inter_18pt-Medium.ttf`,
      fontWeight: 500,
    },
    {
      src: `${GOOGLE_FONTS_BASE}/ofl/inter/static/Inter_18pt-SemiBold.ttf`,
      fontWeight: 600,
    },
  ],
})

Font.register({
  family: 'Source Serif 4',
  fonts: [
    {
      src: `${GOOGLE_FONTS_BASE}/ofl/sourceserif4/static/SourceSerif4-Regular.ttf`,
      fontWeight: 400,
    },
    {
      src: `${GOOGLE_FONTS_BASE}/ofl/sourceserif4/static/SourceSerif4-SemiBold.ttf`,
      fontWeight: 600,
    },
  ],
})

// Disable word hyphenation globally -- legal/civic documents should not auto-hyphenate
Font.registerHyphenationCallback((word) => [word])
