#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(grep '"version"' "$ROOT/PaperRouter/manifest.json" | head -1 | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')
OUT_DIR="$ROOT/dist"
OUT_FILE="$OUT_DIR/paperrouter-${VERSION}.xpi"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

cd "$ROOT/PaperRouter"
zip -r "$OUT_FILE" . \
  -x "*.DS_Store" \
  -x "*/.git/*" \
  -x "design-log-*.md" \
  -x "dev-log.md" \
  -x "DETAILED_INTEGRATION_DIFF_CHECKLIST.md" \
  -x "INTEGRATION_RECORD.md" \
  -x "user-guide.md"

echo "Built: $OUT_FILE"
ls -la "$OUT_FILE"
