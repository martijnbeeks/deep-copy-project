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

## Development Workflow

Follow the "No Vibes" cycle defined in `.cursor/rules/`. Read `.cursor/rules/how-to-write-user-stories.mdc` before creating user stories.
