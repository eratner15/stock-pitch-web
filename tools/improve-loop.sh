#!/usr/bin/env bash
# Karpathy-style auto-research loop for the portal generator.
#
# Each iteration:
#   1. Regenerate a test ticker
#   2. Critique the generated memo against the rubric (density, depth,
#      sidenotes, section pass/fail)
#   3. Print the critique + suggested fixes
#   4. User makes the fixes (or commits to accept) → redeploy → next iter
#
# Usage:
#   tools/improve-loop.sh [TICKER=MSFT] [N=3]
# Writes a markdown log to tools/improve-log/YYYY-MM-DD-TICKER-iterN.md
# so every iteration is auditable.

set -euo pipefail
TICKER="${1:-MSFT}"
N="${2:-3}"
BASE="${BASE:-https://research.levincap.com/stock-pitch}"
LOG_DIR="$(dirname "$0")/improve-log"
mkdir -p "$LOG_DIR"

echo "════════════════════════════════════════════════════════════════"
echo "  KARPATHY LOOP · ticker=$TICKER · iterations=$N"
echo "════════════════════════════════════════════════════════════════"
echo

for i in $(seq 1 "$N"); do
  ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  LOG="$LOG_DIR/$(date -u +%Y%m%d-%H%M%S)-${TICKER}-iter${i}.md"

  echo "━━━ ITERATION $i / $N ━━━"
  echo

  echo "[1/3] Regenerating $TICKER portal..."
  START=$(date +%s)
  RESP=$(curl -sS -X POST -H 'Content-Type: application/json' \
              -d "{\"ticker\":\"$TICKER\"}" --max-time 300 \
              "$BASE/generate")
  END=$(date +%s)
  GEN_TIME=$((END - START))
  echo "  Generated in ${GEN_TIME}s. Response: $(echo "$RESP" | head -c 120)"
  if ! echo "$RESP" | grep -q '"ok":true'; then
    echo "  Generation failed: $RESP" | tee -a "$LOG"
    exit 1
  fi

  echo
  echo "[2/3] Running critique..."
  CRIT=$(curl -sS -X POST -H 'Content-Type: application/json' \
              -d "{\"ticker\":\"$TICKER\"}" --max-time 120 \
              "$BASE/api/portal/critique")

  # Pretty-print the critique
  echo "$CRIT" | python3 -c "
import sys, json
r = json.load(sys.stdin)
print(f\"  Overall: {r['overall_score']}/100 · {r['pass_fail']}\")
print(f\"  Words: {r['total_words']:,} · Source tags: {r['total_source_tags']} (density {r['density_score']:.1f}/1k) · Sidenotes: {r['total_sidenotes']} · H2s: {r['total_h2']}\")
print(f\"  Depth: {r['depth_score']:.0%} of sections hit word target\")
print()
print('  SECTION SCORES:')
for s in r['sections']:
    mark = '✓' if s['ok'] else '✗'
    print(f\"    {mark} {s['label']:30s} {s['actual_words']:>4}w / {s['source_tags']:>2}tags — {s['pass_reason']}\")
print()
print('  LLM CRITIC:')
print('    ' + r['llm_feedback'].replace('\\n', '\\n    '))
print()
print('  FIX RECOMMENDATIONS:')
for i, f in enumerate(r['fix_recommendations'], 1):
    print(f'    [{i}] {f}')
    print()
"

  # Write full report to log
  {
    echo "# Iteration $i · $TICKER · $ISO"
    echo
    echo "Generated in ${GEN_TIME}s"
    echo
    echo "## Critique"
    echo
    echo '```json'
    echo "$CRIT" | python3 -m json.tool
    echo '```'
  } > "$LOG"
  echo "  Report saved → $LOG"

  if [ "$i" -lt "$N" ]; then
    echo
    echo "[3/3] Pausing — make code changes, then press ENTER to run next iteration (Ctrl-C to stop)."
    read -r _ </dev/tty || true
  fi
  echo
done

echo "Loop complete. Reports in $LOG_DIR"
