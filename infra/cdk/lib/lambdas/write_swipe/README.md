# Swipe File Generation Lambda Function

This Lambda function generates swipe files (advertorials) based on selected marketing angles, using AI to rewrite templates with product-specific content.

## Overview

- **Runtime**: Python 3.12 (Docker)
- **Memory**: 3008 MB (3 GB)
- **Timeout**: 600 seconds (10 minutes)
- **Dependencies**: Anthropic Claude, BeautifulSoup4, OpenAI, Pydantic

## Setup

### 1. Store API Keys in AWS Secrets Manager

The function requires both OpenAI and Anthropic API keys stored in Secrets Manager:

```bash
# Store your API keys in Secrets Manager
aws secretsmanager update-secret \
  --secret-id deepcopy-secret-dev \
  --secret-string '{
    "OPENAI_API_KEY":"sk-...",
    "ANTHROPIC_API_KEY":"sk-ant-..."
  }'
```

### 2. Deploy

```bash
cd cdk
npm run build
cdk deploy
```

## API Usage

### Endpoint

The Lambda is invoked asynchronously via EventBridge or directly. Expected event format:

```json
{
  "original_job_id": "uuid-of-original-job",
  "job_id": "uuid-swipe",
  "select_angle": "Marketing angle description"
}
```

### Request Parameters

- **original_job_id**: The job ID of the original comprehensive analysis job
- **job_id**: Unique identifier for this swipe file generation job
- **select_angle**: The marketing angle to focus on for the swipe files

### Response

The function saves results to S3 at:
```
s3://{RESULTS_BUCKET}/results/swipe_files/{job_id}/swipe_files_results.json
```

And updates the DynamoDB job status to `SUCCEEDED` or `FAILED`.

## Architecture

```
┌─────────────┐
│ EventBridge │
│ or Direct   │
│ Invocation  │
└──────┬──────┘
       │
       ↓
┌──────────────────────────────────┐
│ Lambda (Docker)                  │
│ - Python 3.12                    │
│ - 3GB RAM                         │
│ - 10min timeout                   │
│                                   │
│ ┌────────────────────────────┐   │
│ │ Fetch Results from S3       │   │
│ │ - Load comprehensive results│   │
│ │ - Extract research data     │   │
│ └────────────────────────────┘   │
│                                   │
│ ┌────────────────────────────┐   │
│ │ Load Swipe Templates       │   │
│ │ - HTML templates           │   │
│ │ - JSON schemas             │   │
│ └────────────────────────────┘   │
│                                   │
│ ┌────────────────────────────┐   │
│ │ Anthropic Claude API       │   │
│ │ - Rewrite templates        │   │
│ │ - Generate structured output│   │
│ └────────────────────────────┘   │
│                                   │
│ ┌────────────────────────────┐   │
│ │ Save Results               │   │
│ │ - Upload to S3             │   │
│ │ - Update DynamoDB status   │   │
│ └────────────────────────────┘   │
└──────────────────────────────────┘
```

## Local Testing

### Build Docker image

```bash
cd cdk/lib/lambdas/write_swipe
docker build -t swipe-writer:test .
```

### Run locally

```bash
docker run -p 9000:8080 \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e RESULTS_BUCKET="your-bucket-name" \
  -e JOBS_TABLE_NAME="your-table-name" \
  swipe-writer:test
```

### Test with curl

```bash
curl -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H "Content-Type: application/json" \
  -d @test_event.json
```

Or use the provided test script:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
./test_local.sh
```

## Environment Variables

- **RESULTS_BUCKET**: S3 bucket name for storing results and content library
- **JOBS_TABLE_NAME**: DynamoDB table name for job status tracking
- **AWS_REGION**: AWS region (default: eu-west-1)
- **ANTHROPIC_API_KEY**: (Optional) Anthropic API key for local testing

## Dependencies

- `anthropic`: Anthropic Claude API client
- `beautifulsoup4`: HTML parsing for template extraction
- `boto3`: AWS SDK for Python
- `openai`: OpenAI API client (for compatibility)
- `pydantic`: Data validation and serialization
- `requests`: HTTP library

## Troubleshooting

### Timeout Issues
- Increase timeout in CDK stack (max 900s / 15 min)
- Swipe file generation can take 5-10 minutes per template

### Memory Issues
- Current setting: 3008 MB should be sufficient
- Monitor CloudWatch Logs for OOM errors

### API Errors
- Verify API keys are set correctly in Secrets Manager
- Check Anthropic account has credits
- Review CloudWatch Logs for detailed error messages

### Missing Templates
- Ensure swipe file templates exist in S3 at `content_library/{template_id}.html` and `content_library/{template_id}.json`
- Check S3 bucket permissions

## Monitoring

Check CloudWatch Logs:
```bash
aws logs tail /aws/lambda/DeepCopyStack-WriteSwipeLambda --follow
```

View metrics:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=DeepCopyStack-WriteSwipeLambda \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average,Maximum
```

