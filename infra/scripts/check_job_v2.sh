#!/bin/bash

JOB_ID=$1

if [ -z "$JOB_ID" ]; then
  echo "Usage: ./scripts/check_job_v2.sh <JOB_ID>"
  exit 1
fi

# Source environment variables
if [ -f .env ]; then
  source .env
else
  echo "Error: .env file not found"
  exit 1
fi

echo "Getting access token..."
ACCESS_TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=https://deep-copy.api/read https://deep-copy.api/write" \
  "$TOKEN_ENDPOINT" | jq -r .access_token)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
    echo "Failed to get access token"
    exit 1
fi

# Status Endpoint
STATUS_URL="${API_URL}v2/jobs/${JOB_ID}"
RESULT_URL="${API_URL}v2/jobs/${JOB_ID}/result"

echo "Checking status for Job ID: $JOB_ID"

MAX_RETRIES=30
COUNT=0

while [ $COUNT -lt $MAX_RETRIES ]; do
  STATUS_RESPONSE=$(curl -s -X GET "$STATUS_URL" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  STATUS=$(echo "$STATUS_RESPONSE" | jq -r .status)
  echo "Current Status: $STATUS"

  if [ "$STATUS" == "COMPLETED" ] || [ "$STATUS" == "SUCCEEDED" ]; then
    echo "Job Completed!"
    echo "Fetching results..."
    
    RESULT_RESPONSE=$(curl -s -X GET "$RESULT_URL" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
      
    echo "$RESULT_RESPONSE" > last_job_result.json
    echo "Result saved to last_job_result.json"
    
    # Print a summary or the first few lines
    echo "Result Preview:"
    echo "$RESULT_RESPONSE" | jq 'keys'
    exit 0
  elif [ "$STATUS" == "FAILED" ]; then
    echo "Job Failed."
    echo "$STATUS_RESPONSE"
    exit 1
  fi

  COUNT=$((COUNT+1))
  sleep 2
done

echo "Timeout waiting for job completion."
exit 1
