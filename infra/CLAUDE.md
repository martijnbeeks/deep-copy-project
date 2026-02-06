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

## Development Workflow

Follow the "No Vibes" cycle defined in `.cursor/rules/`. Read `.cursor/rules/how-to-write-user-stories.mdc` before creating user stories.
