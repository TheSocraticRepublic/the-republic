import path from 'path'
import { Font } from '@react-pdf/renderer'

/**
 * PDF font registration.
 *
 * Fonts are vendored into `src/lib/pdf/fonts/` and registered by absolute
 * filesystem path. They are NOT fetched over the network.
 *
 * The previous implementation registered `https://github.com/google/fonts/raw/
 * main/ofl/<family>/static/*.ttf`. Google removed the `static/` directory from
 * those families, every URL began returning 404, `renderToStream` threw, and
 * both export routes returned 500 on every request. Fetching fonts at render
 * time made PDF export depend on a third party's directory layout, with a
 * failure mode that only surfaces when a citizen tries to file something.
 *
 * `@react-pdf/font` 4.0.8 `FontSource._load()` has exactly four branches:
 * a standard-font name, a `data:` URL, an `http(s)` URL, and otherwise
 * `fontkit.open(src)` — which expects a path string. There is no Buffer
 * branch; passing one fails at render. Path strings it is.
 *
 * Because these files are read from disk at runtime and no route imports them
 * as modules, Next.js would prune them from the serverless bundle.
 * `outputFileTracingIncludes` in `next.config.ts` pins them into the two
 * export routes. If that tracing ever fails to carry them, this file is where
 * the failure lands — see `fonts/PROVENANCE.md`.
 *
 * See `fonts/PROVENANCE.md` for sources, licences, and how the Inter 18pt
 * statics are generated.
 */

const FONT_DIR = path.join(process.cwd(), 'src', 'lib', 'pdf', 'fonts')

/** Resolve a vendored font file to an absolute path. */
const font = (file: string) => path.join(FONT_DIR, file)

// Italic faces are registered for every roman weight. They are not optional:
// the templates ask for `fontStyle: 'italic'` in six places (`primitives.tsx`
// inline helper, timeline, talking-points, fippa-request, public-comment), and
// @react-pdf throws "Could not resolve font for <family>, fontWeight N,
// fontStyle italic" rather than falling back to the roman. The original
// registration had no italics at all — that fault was simply masked, because
// the remote font fetch 404'd before layout ever asked for one.

Font.register({
  family: 'Instrument Sans',
  fonts: [
    { src: font('InstrumentSans-Regular.ttf'), fontWeight: 400 },
    { src: font('InstrumentSans-Medium.ttf'), fontWeight: 500 },
    { src: font('InstrumentSans-SemiBold.ttf'), fontWeight: 600 },
    { src: font('InstrumentSans-Bold.ttf'), fontWeight: 700 },
    { src: font('InstrumentSans-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: font('InstrumentSans-MediumItalic.ttf'), fontWeight: 500, fontStyle: 'italic' },
    { src: font('InstrumentSans-SemiBoldItalic.ttf'), fontWeight: 600, fontStyle: 'italic' },
    { src: font('InstrumentSans-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ],
})

Font.register({
  family: 'Inter',
  fonts: [
    { src: font('Inter_18pt-Regular.ttf'), fontWeight: 400 },
    { src: font('Inter_18pt-Medium.ttf'), fontWeight: 500 },
    { src: font('Inter_18pt-SemiBold.ttf'), fontWeight: 600 },
    { src: font('Inter_18pt-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: font('Inter_18pt-MediumItalic.ttf'), fontWeight: 500, fontStyle: 'italic' },
    { src: font('Inter_18pt-SemiBoldItalic.ttf'), fontWeight: 600, fontStyle: 'italic' },
  ],
})

Font.register({
  family: 'Source Serif 4',
  fonts: [
    { src: font('SourceSerif4-Regular.ttf'), fontWeight: 400 },
    { src: font('SourceSerif4-SemiBold.ttf'), fontWeight: 600 },
    { src: font('SourceSerif4-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: font('SourceSerif4-SemiBoldItalic.ttf'), fontWeight: 600, fontStyle: 'italic' },
  ],
})

// Disable word hyphenation globally -- legal/civic documents should not auto-hyphenate
Font.registerHyphenationCallback((word) => [word])
