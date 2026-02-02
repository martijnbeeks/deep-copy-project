#!/bin/bash

export CLIENT_ID=5mbatc7uv35hr23qip437s2ai5
export CLIENT_SECRET=1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5
export API_URL=https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod
export TOKEN_ENDPOINT=https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token

ACCESS_TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=https://deep-copy.api/read https://deep-copy.api/write" \
  "$TOKEN_ENDPOINT" | jq -r .access_token)

echo "=== Submitting swipe file job ==="
curl -s -X POST "$API_URL/swipe-files/generate" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "original_job_id": "47fdceed-c87a-4d4c-b41d-8eadb85d5f5d",
    "avatar_id": "weekend-warrior-recreational-athlete",
    "angle_id": "angle-1-return-fast-performance",
    "swipe_file_ids": ["AD0001_POV"],
    "image_style": "realistic"
  }' | jq

echo ""
echo "=== Waiting 5s then checking status ==="
sleep 5

curl -s "$API_URL/swipe-files/47fdceed-c87a-4d4c-b41d-8eadb85d5f5d-swipe" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

echo ""
echo "=== Getting result ==="
curl -s "$API_URL/swipe-files/47fdceed-c87a-4d4c-b41d-8eadb85d5f5d-swipe/result" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
