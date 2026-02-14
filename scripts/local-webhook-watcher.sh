#!/bin/bash
#
# Local webhook watcher — simulates what the Lambda does in production.
# Polls the DeepCopy API for job status and sends the webhook to localhost
# when the job completes.
#
# Usage: ./scripts/local-webhook-watcher.sh <job-id> [port]
#
# Example: ./scripts/local-webhook-watcher.sh a8a8817c-7ed1-4aac-a6cd-3f33959d8dcb 3003

set -euo pipefail

JOB_ID="${1:?Usage: $0 <job-id> [port]}"
PORT="${2:-3000}"
POLL_INTERVAL=10

# Load webhook secret from .env
ENV_FILE="$(dirname "$0")/../app/.env"
if [ -f "$ENV_FILE" ]; then
  WEBHOOK_SECRET=$(grep '^WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2-)
fi
WEBHOOK_SECRET="${WEBHOOK_SECRET:?WEBHOOK_SECRET not found in $ENV_FILE}"

# Cognito credentials
CLIENT_ID="5mbatc7uv35hr23qip437s2ai5"
CLIENT_SECRET="1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5"
TOKEN_URL="https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token"
API_URL="https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod"

echo "=== Local Webhook Watcher ==="
echo "Job ID:   $JOB_ID"
echo "Webhook:  http://localhost:$PORT/api/webhooks/job-complete"
echo "Polling every ${POLL_INTERVAL}s..."
echo ""

# Get access token
ACCESS_TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=https://deep-copy.api/read https://deep-copy.api/write" \
  "$TOKEN_URL" | jq -r .access_token)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "ERROR: Failed to get access token"
  exit 1
fi

# Poll until job completes
while true; do
  STATUS=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$API_URL/v2/jobs/$JOB_ID" | jq -r .status)

  TIMESTAMP=$(date +%H:%M:%S)
  echo "$TIMESTAMP - Status: $STATUS"

  if [ "$STATUS" = "SUCCEEDED" ]; then
    echo ""
    echo "Job completed! Sending webhook..."

    PAYLOAD="{\"jobId\":\"$JOB_ID\",\"status\":\"completed\"}"
    SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:$PORT/api/webhooks/job-complete" \
      -H "Content-Type: application/json" \
      -H "x-webhook-signature: $SIGNATURE" \
      -d "$PAYLOAD")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -1)

    echo "Webhook response: HTTP $HTTP_CODE — $BODY"
    exit 0

  elif [ "$STATUS" = "FAILED" ]; then
    echo ""
    echo "Job failed! Sending webhook..."

    PAYLOAD="{\"jobId\":\"$JOB_ID\",\"status\":\"failed\"}"
    SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')

    curl -s -X POST "http://localhost:$PORT/api/webhooks/job-complete" \
      -H "Content-Type: application/json" \
      -H "x-webhook-signature: $SIGNATURE" \
      -d "$PAYLOAD"

    echo "Done."
    exit 1

  elif [ "$STATUS" = "null" ] || [ -z "$STATUS" ]; then
    echo "ERROR: Could not fetch job status (token expired?)"
    exit 1
  fi

  sleep "$POLL_INTERVAL"
done
