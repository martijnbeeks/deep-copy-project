#!/bin/bash
#
# Webhook watcher daemon — runs alongside the dev server.
# Monitors all "processing" jobs in the database and sends the webhook
# to localhost when a job completes on the DeepCopy API.
#
# Usage: ./scripts/webhook-watcher.sh [port]

set -uo pipefail

PORT="${1:-3000}"
POLL_INTERVAL=10

# Load .env
ENV_FILE="$(dirname "$0")/../app/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "[webhook-watcher] ERROR: $ENV_FILE not found"
  exit 1
fi

WEBHOOK_SECRET=$(grep '^WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2-)
DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d "'\"")

if [ -z "$WEBHOOK_SECRET" ]; then
  echo "[webhook-watcher] ERROR: WEBHOOK_SECRET not found in .env"
  exit 1
fi
if [ -z "$DATABASE_URL" ]; then
  echo "[webhook-watcher] ERROR: DATABASE_URL not found in .env"
  exit 1
fi

# Cognito credentials
CLIENT_ID="5mbatc7uv35hr23qip437s2ai5"
CLIENT_SECRET="1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5"
TOKEN_URL="https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token"
API_URL="https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod"

ACCESS_TOKEN=""
TOKEN_EXPIRY=0

get_token() {
  local NOW
  NOW=$(date +%s)
  if [ "$NOW" -lt "$TOKEN_EXPIRY" ] && [ -n "$ACCESS_TOKEN" ]; then
    return
  fi
  ACCESS_TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
    -d "grant_type=client_credentials&scope=https://deep-copy.api/read https://deep-copy.api/write" \
    "$TOKEN_URL" | jq -r .access_token)
  TOKEN_EXPIRY=$((NOW + 3500))
}

send_webhook() {
  local JOB_ID="$1" STATUS="$2"
  local PAYLOAD="{\"jobId\":\"$JOB_ID\",\"status\":\"$STATUS\"}"
  local SIGNATURE
  SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')

  local RESPONSE
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:$PORT/api/webhooks/job-complete" \
    -H "Content-Type: application/json" \
    -H "x-webhook-signature: $SIGNATURE" \
    -d "$PAYLOAD")

  local HTTP_CODE BODY
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  echo "[webhook-watcher] Webhook sent for $JOB_ID (status=$STATUS) -> HTTP $HTTP_CODE: $BODY"
}

echo "[webhook-watcher] Watching for processing jobs on localhost:$PORT"
echo "[webhook-watcher] Polling every ${POLL_INTERVAL}s..."

while true; do
  # Query DB for processing jobs
  PROCESSING_JOBS=$(psql "$DATABASE_URL" -t -A -F'|' -c \
    "SELECT id, execution_id, target_approach FROM jobs WHERE status IN ('processing', 'submitted', 'pending', 'running') LIMIT 20" 2>/dev/null)

  if [ -n "$PROCESSING_JOBS" ]; then
    get_token

    while IFS='|' read -r JOB_ID EXEC_ID TARGET_APPROACH; do
      [ -z "$JOB_ID" ] && continue

      DEEPCOPY_ID="${EXEC_ID:-$JOB_ID}"

      # Check status on DeepCopy API (use v2 endpoint for v2 jobs)
      if [ "$TARGET_APPROACH" = "v2" ] || [ "$TARGET_APPROACH" = "explore" ]; then
        API_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
          "$API_URL/v2/jobs/$DEEPCOPY_ID")
      else
        API_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
          "$API_URL/jobs/$DEEPCOPY_ID")
      fi

      # Parse JSON safely — skip if API returned non-JSON (e.g., HTML error page)
      API_STATUS=$(echo "$API_RESPONSE" | jq -r '.status // empty' 2>/dev/null)
      if [ $? -ne 0 ] || [ -z "$API_STATUS" ]; then
        # Job not found on API — skip silently
        continue
      fi

      if [ "$API_STATUS" = "SUCCEEDED" ]; then
        echo "[webhook-watcher] $(date +%H:%M:%S) Job $JOB_ID SUCCEEDED"
        send_webhook "$DEEPCOPY_ID" "completed"
      elif [ "$API_STATUS" = "FAILED" ]; then
        echo "[webhook-watcher] $(date +%H:%M:%S) Job $JOB_ID FAILED"
        send_webhook "$DEEPCOPY_ID" "failed"
      else
        echo "[webhook-watcher] $(date +%H:%M:%S) Job $JOB_ID -> $API_STATUS"
      fi
    done <<< "$PROCESSING_JOBS"
  fi

  sleep "$POLL_INTERVAL"
done
