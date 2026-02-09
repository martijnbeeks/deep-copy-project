# CLAUDE.md

## What This Is

Serverless AWS infrastructure for Deep Copy — an AI content generation API. Processes jobs asynchronously using Claude, OpenAI, and Perplexity.

## Project Map

```
cdk/                          # AWS CDK infrastructure (TypeScript)
  lib/deep-copy-stack.ts      # All AWS resources defined here
  lib/lambdas/
    process_job_v2/           # Main AI pipeline (Docker, Python 3.12)
      services/               # AI service integrations
      data_models.py          # Pydantic models for LLM outputs
      prompts.py              # Jinja2 prompt templates
    submit_job_v2.py          # Job submission (inline Python)
    get_job.py                # Job status retrieval
```

## How to Build & Deploy

All commands from `cdk/` directory:

- `npm install` — install dependencies
- `npm run build` — compile TypeScript
- `npm run synth` — generate CloudFormation template
- `npm run deploy` — deploy all stacks

Python Lambdas use **uv** for dependencies (see per-Lambda `pyproject.toml`). Docker images built automatically by CDK.

CI/CD: push to `main` triggers deploy via GitHub Actions. Region: `eu-west-1`.

## S3 Bucket Access (Read-Only)

**Profile:** `AWS_PROFILE=personal-cdk-dev`
**Region:** `eu-west-1`
**Bucket:** `deepcopystack-resultsbucketa95a2103-zhwjflrlpfih`

### Read commands

```bash
# List top-level prefixes
AWS_PROFILE=personal-cdk-dev aws s3 ls s3://deepcopystack-resultsbucketa95a2103-zhwjflrlpfih/ --region eu-west-1

# List contents of a prefix
AWS_PROFILE=personal-cdk-dev aws s3 ls s3://deepcopystack-resultsbucketa95a2103-zhwjflrlpfih/results/ --region eu-west-1

# Download/read a file
AWS_PROFILE=personal-cdk-dev aws s3 cp s3://deepcopystack-resultsbucketa95a2103-zhwjflrlpfih/<key> - --region eu-west-1
```

### Folder structure

| Prefix | Contents |
|--------|----------|
| `results/{job_id}/comprehensive_results.json` | Final job results |
| `results/swipe_files/{job_id}/swipe_files_results.json` | Swipe file results |
| `results/image-gen/{job_id}/image_gen_results.json` | Image generation results |
| `projects/{project_name}/{timestamp}/comprehensive_results.json` | Timestamped project results |
| `cache/research/{cache_key}/research_cache.json` | Research cache (SHA256 key) |
| `content_library/library_summaries.json` | Template/library summaries |
| `image_library/` | Static image library + descriptions JSON |
| `user-uploads/` | User-uploaded content |
| `llm_usage_events/dt={YYYYMMDD}/hour={HH}/jobId={id}/` | LLM telemetry (JSONL) |

## API Testing

**Base URL:** `https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod`

### Authentication

All endpoints require a Cognito OAuth2 Bearer token. Get one with:

```bash
ACCESS_TOKEN=$(curl -s -u "5mbatc7uv35hr23qip437s2ai5:1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5" \
  -d "grant_type=client_credentials&scope=https://deep-copy.api/read https://deep-copy.api/write" \
  "https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token" | jq -r .access_token)
```

### Endpoints

All requests use `--header "Authorization: Bearer $ACCESS_TOKEN"`.

**V2 Jobs (main pipeline)**
```bash
# Submit
curl -s -X POST "$API_URL/v2/jobs" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"sales_page_url":"https://example.com","project_name":"test","gender":"Female","location":"US"}'

# Status
curl -s "$API_URL/v2/jobs/{JOB_ID}" -H "Authorization: Bearer $ACCESS_TOKEN"

# Result
curl -s "$API_URL/v2/jobs/{JOB_ID}/result" -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Image Generation**
```bash
# Submit
curl -s -X POST "$API_URL/image-gen/generate" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"productName":"TestProduct","selectedAvatar":"Men 50-65","selectedAngles":["Pain relief"],"language":"english","productImageUrls":["https://example.com/img.jpg"],"forcedReferenceImageIds":["12.png"]}'

# Status
curl -s "$API_URL/image-gen/{JOB_ID}" -H "Authorization: Bearer $ACCESS_TOKEN"

# Result
curl -s "$API_URL/image-gen/{JOB_ID}/result" -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Swipe Files**
```bash
# Submit
curl -s -X POST "$API_URL/swipe-files/generate" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"original_job_id":"JOB_ID","avatar_id":"avatar-id","angle_id":"angle-id","swipe_file_ids":["AD0001_POV"],"image_style":"realistic"}'

# Status
curl -s "$API_URL/swipe-files/{JOB_ID}" -H "Authorization: Bearer $ACCESS_TOKEN"

# Result
curl -s "$API_URL/swipe-files/{JOB_ID}/result" -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Prelander Images**
```bash
# Submit
curl -s -X POST "$API_URL/prelander-images/generate" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"...":"see openapi.yaml for schema"}'

# Status
curl -s "$API_URL/prelander-images/{JOB_ID}" -H "Authorization: Bearer $ACCESS_TOKEN"

# Result
curl -s "$API_URL/prelander-images/{JOB_ID}/result" -H "Authorization: Bearer $ACCESS_TOKEN"
```

Full API spec: `cdk/openapi.yaml`

## Development Workflow

Follow the "No Vibes" cycle defined in `.cursor/rules/`. Read `.cursor/rules/how-to-write-user-stories.mdc` before creating user stories.
