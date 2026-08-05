#!/usr/bin/env bash
# Design-token drift lint gate (Open Cave design-system relay, Run 3).
#
# Enforces two invariants introduced by Runs 1-2 so the drift they fixed
# can't silently come back:
#
#   1. Type floor -- 9px/10px/11px raw arbitrary Tailwind sizes are
#      abolished. Data values use text-xs (12px, pre-existing), labels use
#      the new text-2xs (11px), uppercase/tracked micro tags use the new
#      text-3xs (10px). See globals.css @theme inline block and CLAUDE.md.
#
#   2. Status-hex floor -- the dark-mode --status-* hex values (plus the
#      two pre-lift hexes they replaced) must not be reintroduced as raw
#      literals anywhere in src/. They belong behind
#      var(--status-success|danger|warning|neutral) or
#      color-mix(in srgb, var(--status-*) N%, transparent).
#
# Exit 0 = clean. Exit 1 = drift detected (printed below).
#
# Run standalone: ./scripts/lint-design-tokens.sh
# Wired into CI:  .github/workflows/ci.yml "Design token lint" step.

set -uo pipefail

FAIL=0

echo "== Gate 1: type floor (abolished text-[9px]/text-[10px]/text-[11px]) =="
TYPE_FLOOR_HITS=$(grep -rnE 'text-\[(9|10|11)px\]' src/ 2>/dev/null)
if [ -n "$TYPE_FLOOR_HITS" ]; then
  echo "FAIL: abolished arbitrary text size(s) found -- use text-3xs (10px) / text-2xs (11px) / text-xs (12px) instead:"
  echo "$TYPE_FLOOR_HITS"
  FAIL=1
else
  echo "OK: 0 hits"
fi

echo
echo "== Gate 2: raw status-hex literals in src/ =="
# Forbidden: the dark-mode status hexes (#4ade80 success, #f87171 danger,
# #f59e0b warning) plus two pre-lift hexes a regression could reintroduce
# (#ef4444 -> lifted to #f87171 for danger contrast; #737373 -> lifted to
# #a1a1aa for neutral contrast, see Batch 1A of the Jen spec).
#
# #a1a1aa is deliberately NOT in this forbidden set -- it is the correct,
# un-drifted current value for BOTH --status-neutral and --text-muted, and
# it's legitimately hardcoded in six local light/dark palette objects that
# are out of scope for this relay (briefing-view.tsx, campaign-panel.tsx,
# reasoning-card.tsx x2, issue-timeline.tsx DARK_TL, lens-panel.tsx,
# player-card.tsx DARK_CARD -- see Jen spec Batch 2b). Gating on it would
# false-positive on every one of those six files.
#
# Searches all of src/ (not just src/components) so a regression in
# src/app pages (e.g. votes/bill/[billId], votes/recent -- both converted
# by this relay) is caught too. Widening past src/components surfaces two
# more legitimate, narrowly-justified exceptions (below) that never showed
# up under the old src/components-only scope.
ALL_HITS=$(grep -rnE '#(4ade80|f87171|ef4444|f59e0b|737373)' src/ 2>/dev/null)

# Allowlist 1: src/components/lens/player-card.tsx, hexes #4ade80 / #f59e0b
# only -- matched by file + hex, not pinned line numbers, so an unrelated
# edit shifting these lines can't false-positive the gate.
# PLAYER_TYPE_STYLES assigns one fixed hue per player TYPE (organization =
# #4ade80, rights_holder = #f59e0b) -- a categorical identity color for a
# classification a player doesn't transition between, structurally the same
# as action-card.tsx's document-type colors. Two of the five hues happen to
# equal today's status green/amber by coincidence of a shared palette, not
# because they carry status meaning. Ruled STAYS, do not convert, by the
# Jen spec (Batch 2b). The border-emphasis use reuses the same
# rights_holder hue, not a new color.
#
# Allowlist 2: src/app/globals.css -- this is the token DEFINITION site.
# The --status-* custom properties are assigned these exact hex literals;
# grepping the definition for its own values isn't drift, it's the source
# of truth the rest of the gate protects. Whole-file exempt.
#
# Allowlist 3: src/app/icon.tsx -- the Next.js favicon, rendered via
# next/og's ImageResponse (Satori), which cannot consume CSS custom
# properties -- only literal values reach the renderer, so var(--status-*)
# is not an option here. The gradient is also semantically unrelated: a
# decorative "light inside the cave" brand glyph, not a status pill. Only
# #f59e0b appears in the forbidden set (paired with #fbbf24, which isn't
# forbidden); matched by file + hex for the same reason as allowlist 1.
UNALLOWED_HITS=$(printf '%s\n' "$ALL_HITS" | grep -v '^$' \
  | grep -vE '^src/components/lens/player-card\.tsx:[0-9]+:.*#(4ade80|f59e0b)' \
  | grep -vE '^src/app/globals\.css:' \
  | grep -vE '^src/app/icon\.tsx:[0-9]+:.*#f59e0b')

if [ -n "$UNALLOWED_HITS" ]; then
  echo "FAIL: raw status-hex literal(s) found in src/ -- use var(--status-success|danger|warning|neutral) instead:"
  echo "$UNALLOWED_HITS"
  FAIL=1
else
  echo "OK: only the allowlisted player-card.tsx categorical hexes remain"
fi

echo
echo "== Gate 3: red-family Tailwind palette classes in src/ =="
# Danger signals belong on the status token (text-status-danger etc.), not
# the raw red palette -- red-400 happens to equal the dark --status-danger
# value today, so palette classes render "correctly" in dark and then break
# silently in .light-scope / island surfaces where the token re-resolves.
# Swept to zero by the 2026-08-05 code-refresh (~35 sites).
#
# Allowlist: analysis-view.tsx POWER_MAP_ENTRIES -- a five-way CATEGORICAL
# palette for power-map roles (Oversight Gaps happens to be red); it is not
# a status signal. Same ruling class as player-card.tsx in Gate 2. The
# emerald/yellow/amber families are NOT gated yet -- their remaining sites
# are design-batch work (tinted body copy, archive washes); extend this
# gate when that batch lands.
RED_HITS=$(grep -rnE '(text|bg|border)-red-[0-9]{3}' src/ 2>/dev/null \
  | grep -vE '^src/components/oracle/analysis-view\.tsx:[0-9]+:.*text-red-400')
if [ -n "$RED_HITS" ]; then
  echo "FAIL: raw red palette class(es) found -- use text-status-danger / bg-status-danger/N / border-status-danger/N:"
  echo "$RED_HITS"
  FAIL=1
else
  echo "OK: 0 hits outside the allowlisted categorical palette"
fi

exit $FAIL
