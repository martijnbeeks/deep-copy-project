#!/usr/bin/env bash
set -euo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env if present
if [ -f "$TESTS_DIR/.env" ]; then
  export $(grep -v '^#' "$TESTS_DIR/.env" | grep -v '^\s*$' | xargs)
fi

# Validate DATABASE_URL is set — skip gracefully in worktrees missing .env
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Skipping tests: DATABASE_URL not set (missing tests/.env — expected in worktrees)."
  exit 0
fi

LAMBDAS_DIR="$(cd "$TESTS_DIR/.." && pwd)"
EXIT_CODE=0

for lambda in process_job_v2 image_gen_process write_swipe prelander_image_gen; do
  echo ""
  echo "=== Testing $lambda ==="
  echo ""
  VENV_PYTHON="$LAMBDAS_DIR/$lambda/.venv/bin/python"
  if [ -x "$VENV_PYTHON" ]; then
    "$VENV_PYTHON" -m pytest "$TESTS_DIR/$lambda/" -v --timeout=60 --tb=short || EXIT_CODE=1
  else
    echo "Skipping $lambda: no venv at $VENV_PYTHON (run uv sync in that lambda first)"
  fi
done

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "=== All test suites passed ==="
else
  echo "=== Some test suites failed ==="
fi

exit $EXIT_CODE
