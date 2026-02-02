# Avatar Extraction Lambda Function

This Lambda function extracts customer avatars (personas) from product pages using AI vision and Playwright.

## Overview

- **Runtime**: Python 3.11 (Docker)
- **Memory**: 3008 MB (3 GB)
- **Timeout**: 60 seconds
- **Dependencies**: Playwright (Chromium), OpenAI, Pydantic

## Setup

### 1. Store OpenAI API Key in AWS Secrets Manager

```bash
# Store your OpenAI API key in Secrets Manager
aws secretsmanager create-secret \
  --name deep-copy/openai-api-key \
  --description "OpenAI API key for avatar extraction" \
  --secret-string '{"OPENAI_API_KEY":"sk-..."}'

# Or update existing secret
aws secretsmanager update-secret \
  --secret-id deep-copy/openai-api-key \
  --secret-string '{"OPENAI_API_KEY":"sk-..."}'
```

### 2. Update Lambda Handler to Read from Secrets Manager

The handler automatically reads the `OPENAI_API_KEY` from environment variables. You can either:

**Option A**: Set it directly in the Lambda environment (not recommended for production)
```typescript
// In deep-copy-stack.ts
environment: {
  OPENAI_API_KEY: 'sk-...',  // Not recommended
  OPENAI_MODEL: 'gpt-4o-mini',
}
```

**Option B**: Read from Secrets Manager (recommended)
```python
# Already implemented in handler.py with fallback
import boto3
import json

def get_openai_api_key():
    # Try environment first
    key = os.environ.get('OPENAI_API_KEY')
    if key:
        return key
    
    # Fall back to Secrets Manager
    secrets_client = boto3.client('secretsmanager')
    response = secrets_client.get_secret_value(SecretId='deep-copy/openai-api-key')
    secret = json.loads(response['SecretString'])
    return secret['OPENAI_API_KEY']
```

### 3. Deploy

```bash
cd cdk
npm run build
cdk deploy
```

## API Usage

### Endpoint

```
POST /avatars/extract
```

### Authentication

Uses Cognito OAuth2 with `https://deep-copy.api/write` scope.

### Request

```json
{
  "url": "https://www.sciatiease.com/sciatiease.php"
}
```

### Response

```json
{
  "success": true,
  "url": "https://www.sciatiease.com/sciatiease.php",
  "avatars": [
    {
      "persona_name": "Active Senior",
      "description": "Retired professional who enjoys gardening and light exercise but struggles with chronic sciatic pain that limits mobility.",
      "age_range": "60-75",
      "gender": "both",
      "key_buying_motivation": "Seeking non-invasive pain relief to maintain an active lifestyle without medication dependency."
    },
    {
      "persona_name": "Desk-Bound Professional",
      "description": "Office worker sitting 8+ hours daily experiencing lower back and leg pain from poor posture and sedentary lifestyle.",
      "age_range": "30-45",
      "gender": "both",
      "key_buying_motivation": "Wants quick relief from work-related pain to improve productivity and quality of life."
    },
    {
      "persona_name": "Fitness Enthusiast in Recovery",
      "description": "Gym-goer who developed sciatica from heavy lifting or improper form, now seeking recovery solutions.",
      "age_range": "25-40",
      "gender": "both",
      "key_buying_motivation": "Looking for a way to heal and prevent future injury while returning to training safely."
    }
  ]
}
```

### Example with curl

```bash
# Get access token
TOKEN_ENDPOINT="https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token"
CLIENT_ID="your-client-id"
CLIENT_SECRET="your-client-secret"

ACCESS_TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=https://deep-copy.api/write" \
  "$TOKEN_ENDPOINT" | jq -r .access_token)

# Call avatar extraction
API_URL="https://your-api-id.execute-api.eu-west-1.amazonaws.com/prod/"

curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.sciatiease.com/sciatiease.php"}' \
  "${API_URL}avatars/extract"
```

## Architecture

```
┌─────────────┐
│ API Gateway │
│ POST        │
│ /avatars/   │
│ extract     │
└──────┬──────┘
       │
       ↓
┌──────────────────────────────────┐
│ Lambda (Docker)                  │
│ - Python 3.11                    │
│ - 3GB RAM                         │
│ - 60s timeout                     │
│                                   │
│ ┌────────────────────────────┐   │
│ │ Playwright                 │   │
│ │ - Launch Chromium          │   │
│ │ - Load product page        │   │
│ │ - Capture screenshot       │   │
│ └────────────────────────────┘   │
│                                   │
│ ┌────────────────────────────┐   │
│ │ OpenAI Vision API          │   │
│ │ - Analyze screenshot       │   │
│ │ - Extract avatars          │   │
│ │ - Return structured data   │   │
│ └────────────────────────────┘   │
└──────────────────────────────────┘
```

## Local Testing

### Build Docker image

```bash
cd cdk/lib/lambdas/extract_avatars
docker build -t avatar-extractor .
```

### Run locally

```bash
docker run -p 9000:8080 \
  -e OPENAI_API_KEY="sk-..." \
  avatar-extractor
```

### Test with curl

```bash
curl -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"body": "{\"url\": \"https://www.sciatiease.com/sciatiease.php\"}"}'
```

## Cost Estimates

### AWS Lambda
- **Memory**: 3008 MB
- **Duration**: ~10-30 seconds per request
- **Cost**: ~$0.001 per invocation

### OpenAI API
- **Model**: gpt-4o-mini (vision)
- **Cost**: ~$0.01-0.02 per request
- Full page screenshots are typically 200-500KB base64 encoded

### Total per request
~$0.011-0.021 per avatar extraction

## Troubleshooting

### Timeout Issues
- Increase timeout in `deep-copy-stack.ts`
- Some pages take longer to load
- Default is 60s, max is 900s (15 min)

### Memory Issues
- Playwright + Chromium requires ~2-3GB
- Current setting: 3008 MB should be sufficient
- Monitor CloudWatch Logs for OOM errors

### OpenAI API Errors
- Verify API key is set correctly
- Check OpenAI account has credits
- Model name must be exact: `gpt-4o-mini`

## Monitoring

Check CloudWatch Logs:
```bash
aws logs tail /aws/lambda/DeepCopyStack-ExtractAvatarsLambda --follow
```

View metrics:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=DeepCopyStack-ExtractAvatarsLambda \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average,Maximum
```

