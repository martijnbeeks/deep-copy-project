# CLAUDE.md

## What This Is

**Deep Copy** — AI-powered content generation SaaS. Monorepo with a Next.js frontend and serverless AWS backend.

## Monorepo Structure

```
app/                    # Next.js 14 frontend (React 18, TypeScript, Tailwind)
  app/                  # App Router pages & API routes
  components/           # React components (Radix UI + custom)
  lib/                  # Utilities, services, validation
  stores/               # Zustand state stores
  hooks/                # Custom React hooks
  contexts/             # React Context providers

infra/                  # AWS infrastructure (CDK, TypeScript)
  cdk/                  # CDK app and stack definitions
    lib/lambdas/        # Python Lambda functions
      process_job_v2/   # Main AI processing pipeline
```

## How to Build & Run

**Frontend** (from `app/`):
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint

**Infrastructure** (from `infra/cdk/`):
- `npm run build` — compile TypeScript
- `npm run synth` — generate CloudFormation
- `npm run deploy` — deploy all stacks

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind, Radix UI, Zustand, React Query |
| Backend | AWS Lambda (Python 3.12), API Gateway, DynamoDB, S3, Cognito |
| AI Services | Claude (Anthropic), OpenAI, Perplexity |
| Deploy | GitHub Actions → AWS (eu-west-1), Vercel (frontend) |

## Development Workflow

Follow the "No Vibes" cycle in `.cursor/rules/`. Read `.cursor/rules/how-to-write-user-stories.mdc` before creating user stories.

## Deeper Context

For task-specific details, read the relevant subdirectory:
- `infra/CLAUDE.md` — infrastructure architecture, Lambda details
- `.cursor/rules/` — development workflow, user story format
