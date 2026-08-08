# Vendored PDF fonts — provenance

These files are committed deliberately. `@react-pdf/renderer` resolves fonts at
render time, and the previous implementation pointed `Font.register` at
`https://github.com/google/fonts/raw/main/ofl/<family>/static/*.ttf`. Google
removed the `static/` subdirectory from those families — they now ship
variable-only — so all nine URLs began returning 404, `renderToStream` threw,
and `/api/campaign/export` and `/api/lever/export?format=pdf` returned 500 on
every request.

Fetching fonts over the network at render time was the defect. A remote URL
makes every PDF export depend on a third party's directory layout, and the
failure is silent until a citizen tries to file something. The fonts are
vendored so the render path touches nothing but the local filesystem.

All three families are SIL Open Font License 1.1, which permits redistribution.
Each family's licence is included alongside its files. This repository is
AGPLv3; the OFL fonts are not covered by it and remain under the OFL.

## Sources

Sourced from each family's own upstream release repository, **not** from a
`google/fonts` path — the `google/fonts` mirror is what broke.

| File | Source | Licence file |
|---|---|---|
| `InstrumentSans-{Regular,Medium,SemiBold,Bold}.ttf` | `Instrument/instrument-sans` → `fonts/ttf/` | `InstrumentSans-OFL.txt` |
| `InstrumentSans-{Italic,MediumItalic,SemiBoldItalic,BoldItalic}.ttf` | same | same |
| `Inter_18pt-{Regular,Medium,SemiBold}.ttf` | `rsms/inter` v4.1 release → `InterVariable.ttf`, instanced (see below) | `Inter-OFL.txt` |
| `Inter_18pt-{Italic,MediumItalic,SemiBoldItalic}.ttf` | same, from `InterVariable-Italic.ttf` | same |
| `SourceSerif4-{Regular,SemiBold}.ttf` | `adobe-fonts/source-serif` → `TTF/` | `SourceSerif4-OFL.txt` |
| `SourceSerif4-{Italic,SemiBoldItalic}.ttf` | same (`SourceSerif4-It.ttf`, `SourceSerif4-SemiboldIt.ttf`) | same |

### Why the italics are here

The original registration listed nine roman faces and no italics. The templates
ask for `fontStyle: 'italic'` in six places, and `@react-pdf` throws
`Could not resolve font for <family>, fontWeight N, fontStyle italic` rather
than substituting the roman. That was a second latent 500 sitting behind the
first: the remote fetch 404'd before layout ever got far enough to ask for an
italic, so the fault never surfaced separately. Vendoring only the nine romans
would have left `talking_points`, `fippa_request`, and `public_comment` still
returning 500. Every roman weight now has a matching italic.

## The Inter statics are generated, not downloaded

rsms/inter ships `extras/ttf/Inter-*.ttf` at the default optical size (`opsz`
14). The styles in `src/lib/pdf/styles.ts` were written against Google's
`Inter_18pt-*` build, which is the same variable font instanced at `opsz` 18 —
different metrics, different spacing. To preserve those metrics without
re-introducing a `google/fonts` dependency, these three files were instanced
from the official `InterVariable.ttf` (Inter v4.1) with `fontTools.varLib.instancer`:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

for wght, style in [(400, 'Regular'), (500, 'Medium'), (600, 'SemiBold')]:
    f = TTFont('InterVariable.ttf')
    # updateFontNames=False: Inter's STAT table declares no named axis value at
    # opsz=18, so fontTools cannot derive names automatically. Set manually.
    instancer.instantiateVariableFont(
        f, {'opsz': 18, 'wght': wght}, inplace=True, updateFontNames=False
    )
    name = f['name']
    for nid, val in [(1, 'Inter 18pt'), (2, style), (4, f'Inter 18pt {style}'),
                     (6, f'Inter18pt-{style}'), (16, 'Inter 18pt'), (17, style)]:
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)
    f.save(f'Inter_18pt-{style}.ttf')
```

To regenerate: download `Inter-4.1.zip` from the `rsms/inter` releases, extract
`InterVariable.ttf`, and re-run the above.

## Adding a weight

Add the file here, add its licence if the family is new, and register it in
`fonts.ts`. `tests/unit/pdf-render.test.ts` asserts that no registered `src` is
an `http(s)` URL — that guard is what keeps this from regressing to a remote
fetch. Do not remove it.
