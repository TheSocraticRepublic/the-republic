#!/bin/bash
# Build cameo SVGs from traced profiles
# Each profile path gets placed inside a colored circle mask

TRACED_DIR="traced"
FINAL_DIR="final"
mkdir -p "$FINAL_DIR"

declare -A COLORS
COLORS[peripatetic]="#5BC88A"
COLORS[pythia]="#89B4C8"
COLORS[gadfly]="#C8A84B"
COLORS[herald]="#C85B5B"
COLORS[traveller]="#5BC88A"

declare -A NAMES
NAMES[peripatetic]="The Peripatetic"
NAMES[pythia]="The Pythia"
NAMES[gadfly]="The Gadfly"
NAMES[herald]="The Herald"
NAMES[traveller]="The Traveller"

for char in peripatetic pythia gadfly herald traveller; do
  COLOR="${COLORS[$char]}"
  NAME="${NAMES[$char]}"
  TRACED="$TRACED_DIR/${char}-traced.svg"
  OUT="$FINAL_DIR/${char}-cameo.svg"

  # Extract path data from potrace SVG (everything between <g> tags)
  PATHS=$(sed -n '/<g transform/,/<\/g>/p' "$TRACED")

  cat > "$OUT" << SVGEOF
<!-- ${NAME}: negative space cameo profile, traced from classical reference -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <mask id="${char}-mask">
      <circle cx="256" cy="256" r="240" fill="white"/>
      ${PATHS}
    </mask>
  </defs>
  <circle cx="256" cy="256" r="240" fill="${COLOR}" mask="url(#${char}-mask)"/>
</svg>
SVGEOF

  echo "Built $OUT"
done
