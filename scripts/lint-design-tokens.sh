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
#      literals in src/components. They belong behind
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
echo "== Gate 2: raw status-hex literals in src/components =="
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
ALL_HITS=$(grep -rnE '#(4ade80|f87171|ef4444|f59e0b|737373)' src/components 2>/dev/null)

# Allowlist: src/components/lens/player-card.tsx lines 79, 84, 140.
# PLAYER_TYPE_STYLES assigns one fixed hue per player TYPE (organization =
# #4ade80, rights_holder = #f59e0b) -- a categorical identity color for a
# classification a player doesn't transition between, structurally the same
# as action-card.tsx's document-type colors. Two of the five hues happen to
# equal today's status green/amber by coincidence of a shared palette, not
# because they carry status meaning. Ruled STAYS, do not convert, by the
# Jen spec (Batch 2b). Line 140 reuses the same rights_holder hue as an
# emphasis border, not a new color.
UNALLOWED_HITS=$(printf '%s\n' "$ALL_HITS" | grep -vE '^src/components/lens/player-card\.tsx:(79|84|140):' | grep -v '^$')

if [ -n "$UNALLOWED_HITS" ]; then
  echo "FAIL: raw status-hex literal(s) found in src/components -- use var(--status-success|danger|warning|neutral) instead:"
  echo "$UNALLOWED_HITS"
  FAIL=1
else
  echo "OK: only the allowlisted player-card.tsx categorical hexes remain"
fi

exit $FAIL
