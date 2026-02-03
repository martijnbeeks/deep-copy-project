# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

Monorepo with two workspaces merged from separate Git histories:

- **`app/`** — Next.js 14 frontend (AI copywriting web application)
- **`infra/`** — AWS serverless backend (CDK + Lambda functions in Python)

## Build & Dev Commands

### Frontend (`app/`)

```bash
cd app
npm install
npm run dev          # start dev server
npm run dev:clean    # clean .next cache, then dev
npm run build        # production build
npm run lint         # ESLint (next lint)
```

- TypeScript path alias: `@/*` maps to `./` (e.g., `@/components/ui/button`)
- ESLint and TS errors are ignored during `next build` (configured in next.config.mjs)

### Infrastructure (`infra/cdk/`)

```bash
cd infra/cdk
npm install
npm run build        # compile TypeScript (tsc)
npm run synth        # generate CloudFormation template
npm run deploy       # cdk deploy --all
```

- Requires Node.js 22+ (see `infra/.nvmrc`)
- Python Lambda dependencies use **uv** (per-Lambda `pyproject.toml` + `uv.lock`)
- Docker images for processing Lambdas are built automatically by CDK during deploy
- CI/CD: push to `main` triggers GitHub Actions deploy (`infra/.github/workflows/deploy.yml`), AWS region `eu-west-1`

## Architecture

### Frontend (app/)

Next.js 14 App Router with React Server Components. Key layers:

- **`app/`** — Pages and API routes (file-based routing)
- **`components/`** — React components; `components/ui/` contains shadcn/ui (New York style)
- **`lib/db/`** — PostgreSQL database layer with connection pooling and retry logic
- **`lib/auth/`** — Authentication (user auth via bcrypt, org-based access control, admin auth, DeepCopy API auth)
- **`lib/services/`** — Business logic including background polling for job status
- **`stores/`** — Zustand stores (auth, jobs, templates)
- **`contexts/`** — React contexts (app, polling, loading, sidebar)
- **`hooks/`** — Custom hooks including auto-polling and job polling

State management: TanStack React Query for server state, Zustand for global state, React Hook Form + Zod for forms.

UI: Tailwind CSS + shadcn/ui (Radix primitives) + Framer Motion. Dark mode via `next-themes` (class-based).

### Backend (infra/)

Serverless AWS stack defined in `infra/cdk/lib/deep-copy-stack.ts`:

```
API Gateway + Cognito Auth (OAuth2 client credentials)
  → Submission Lambda (inline Python 3.11, e.g. submit_job_v2.py)
  → Async Processing Lambda (Docker, Python 3.12, 3GB RAM, 15min timeout)
  → Results to S3 (results/{jobId}/...) + status updates in DynamoDB
  → Retrieval Lambda returns status/results
```

**Processing Lambdas** (Docker-based, `infra/cdk/lib/lambdas/`):
- `process_job_v2/` — Main AI pipeline: market research (Perplexity) → avatar extraction (Claude) → marketing angles → belief transformation → offer brief
- `write_swipe/` — Advertorial/swipe file rewriting
- `extract_avatars/` — Customer persona extraction
- `image_gen_process/` — DALL-E/Gemini image generation

**Pipeline architecture** (`process_job_v2/`):
- `handler.py` → `pipeline/orchestrator.py` → `pipeline/steps/` (analyze_page, deep_research, avatars, marketing, offer_brief, summary, template_prediction)
- Services: `services/claude_service.py`, `openai_service.py`, `perplexity_service.py`, `aws.py`
- Data models: `data_models.py` (Pydantic structured outputs)
- Prompts: `prompts.py` (Jinja2 templates)

**Lightweight Lambdas** (inline Python): `submit_job_v2.py`, `get_job.py`, `get_job_result.py`

**Data layer**: DynamoDB (`jobId` partition key), S3 (`results/{jobId}/`), Secrets Manager (API keys)

**Auth**: Cognito OAuth2 client credentials. Scopes: `https://deep-copy.api/read`, `https://deep-copy.api/write`.

### API Endpoints

- `POST /v2/jobs` — submit v2 job (requires `write` scope)
- `GET /jobs/{id}` — job status
- `GET /jobs/{id}/result` — result JSON from S3
- Additional endpoints for avatars, swipe files, image generation

## Development Workflow

This project follows a **"No Vibes" development cycle** (see `infra/.cursor/rules/`):

1. **Research** — Read and grep the codebase before proposing changes. Verify exact files and line ranges.
2. **Plan** — Create a User Story in `infra/user_stories/` with status DRAFT → READY.
3. **Code** — Execute strictly against the READY user story. No silent scope expansion or drive-by refactoring.
4. **Complete** — Move US to `completed/`, generate implementation summary.

## Key Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 14, React 18, TypeScript 5, Tailwind CSS, shadcn/ui, Zustand, TanStack Query |
| Database | PostgreSQL (pg), Zod validation |
| Infrastructure | AWS CDK 2.154, Lambda, DynamoDB, S3, API Gateway, Cognito |
| AI/ML | Claude (Anthropic), GPT-4 (OpenAI), Perplexity, DALL-E, LangChain |
| Python | Python 3.12, Pydantic, Jinja2, Playwright (web scraping), uv (deps) |
| CI/CD | GitHub Actions, Docker |
