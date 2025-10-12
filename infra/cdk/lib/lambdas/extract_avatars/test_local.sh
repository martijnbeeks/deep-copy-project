#!/bin/bash

# Test script for local Docker testing
# Usage: ./test_local.sh

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY environment variable is not set"
    echo "Set it with: export OPENAI_API_KEY='sk-...'"
    exit 1
fi

# Start the Docker container in the background
echo "Starting Docker container..."
docker run -d -p 9000:8080 \
  -e AWS_REGION=eu-west-1 \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  --name avatar-extractor-test \
  avatar-extractor:test

# Wait for container to start
echo "Waiting for container to start..."
sleep 3

# Test the function
echo -e "\n🚀 Testing avatar extraction..."
echo "URL: https://www.sciatiease.com/sciatiease.php"
echo ""

curl -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H "Content-Type: application/json" \
  -d '{"body": "{\"url\": \"https://www.sciatiease.com/sciatiease.php\"}"}' \
  | jq '.'

# Stop and remove the container
echo -e "\n\n🧹 Cleaning up..."
docker stop avatar-extractor-test
docker rm avatar-extractor-test

echo "Done!"

