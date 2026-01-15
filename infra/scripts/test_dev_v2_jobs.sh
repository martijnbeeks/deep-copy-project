#!/bin/bash

# Source environment variables
if [ -f .env ]; then
  source .env
else
  echo "Error: .env file not found"
  exit 1
fi

# Check if required variables are set
if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ] || [ -z "$TOKEN_ENDPOINT" ] || [ -z "$API_URL" ]; then
  echo "Error: Missing required environment variables in .env"
  echo "Required: CLIENT_ID, CLIENT_SECRET, TOKEN_ENDPOINT, API_URL"
  exit 1
fi

echo "Getting access token..."
ACCESS_TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=https://deep-copy.api/read https://deep-copy.api/write" \
  "$TOKEN_ENDPOINT" | jq -r .access_token)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
    echo "Failed to get access token"
    # Try to print the error response
    curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
      -d "grant_type=client_credentials&scope=https://deep-copy.api/read https://deep-copy.api/write" \
      "$TOKEN_ENDPOINT"
    exit 1
fi

echo "Access token received."

# Endpoint URL
DEV_V2_JOBS_URL="${API_URL}dev/v2/jobs"

echo "Submitting job to dev v2 endpoint: $DEV_V2_JOBS_URL"
RESPONSE=$(curl -s -X POST "$DEV_V2_JOBS_URL" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sales_page_url": "https://naxir.co/products/steadystrap",
    "project_name": "test-dev-v2",
    "research_requirements": "Test research requirements for dev mode",
    "gender": "Female",
    "location": "US"
  }')

echo "Response:"
echo "$RESPONSE" | jq .
