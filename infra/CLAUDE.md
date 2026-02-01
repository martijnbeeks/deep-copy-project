# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Deploy Commands

All CDK commands run from the `cdk/` directory:

```bash
cd cdk
npm install          # install dependencies
npm run build        # compile TypeScript (tsc)
npm run watch        # compile in watch mode
npm run synth        # generate CloudFormation template
npm run deploy       # deploy all stacks (cdk deploy --all)
```

Python Lambda dependencies use **uv** (defined in per-Lambda `pyproject.toml` files). Docker images are built automatically by CDK during deploy.

CI/CD: push to `main` triggers GitHub Actions deploy (`.github/workflows/deploy.yml`). AWS region: `eu-west-1`.

## Architecture

**Serverless AWS stack** defined in `cdk/lib/deep-copy-stack.ts` using AWS CDK (TypeScript).

### Request Flow

```
API Gateway + Cognito Auth (OAuth2 client credentials)
  → Submission Lambda (lightweight Python 3.11, e.g. submit_job_v2.py)
  → Async invokes Processing Lambda (Docker, Python 3.12, 3GB RAM, 15min timeout)
  → Writes results to S3 (results/{jobId}/...) + updates DynamoDB status
  → Retrieval Lambda returns status/results (get_job.py, get_job_result.py)
```

### Key Components

- **Infrastructure**: `cdk/lib/deep-copy-stack.ts` — all AWS resources (Lambdas, DynamoDB, S3, API Gateway, Cognito)
- **Processing Lambdas** (Docker-based, in `cdk/lib/lambdas/`):
  - `process_job_v2/` — main AI content pipeline (current version)
  - `process_job/` — v1 pipeline (legacy)
  - `write_swipe/` — swipe file generation
  - `extract_avatars/` — avatar extraction
  - `image_gen_process/` — image generation
- **Lightweight Lambdas** (inline Python): `submit_job.py`, `submit_job_v2.py`, `get_job.py`, `get_job_result.py`
- **AI Services** (`process_job_v2/services/`): Claude (Anthropic), OpenAI, Perplexity integrations
- **Data models**: `process_job_v2/data_models.py` — Pydantic models for structured LLM outputs
- **Prompts**: `process_job_v2/prompts.py` — Jinja2-based LLM prompt templates

### Data Layer

- **DynamoDB**: `JobsTable` (partition key: `jobId`, on-demand billing)
- **S3**: Results bucket with prefix `results/{jobId}/`
- **Secrets Manager**: API keys for OpenAI, Anthropic, Perplexity

## Development Workflow

This project follows a **"No Vibes" development cycle** (defined in `.cursor/rules/`):

1. **Research** — Read and grep the codebase before proposing changes. Verify exact files and line ranges.
2. **Plan** — Create a User Story in `user_stories/` following the strict format in `.cursor/rules/how-to-write-user-stories.mdc` (status: DRAFT → READY).
3. **Code** — Execute strictly against the READY user story. No silent scope expansion.
4. **Complete** — Move US to `user_stories/completed/`, generate `_IMPLEMENTATION_SUMMARY.md`.

## API Endpoints

- `POST /jobs` — submit a job (requires `write` scope)
- `GET /jobs/{id}` — get job status
- `GET /jobs/{id}/result` — get result JSON from S3
- `POST /v2/jobs` — submit v2 job
- Additional endpoints for avatars, swipe files, image generation

Auth: Cognito User Pool with OAuth2 client credentials flow. Scopes: `https://deep-copy.api/read`, `https://deep-copy.api/write`.
