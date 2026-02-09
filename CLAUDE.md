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

## API Testing

**Base URL:** `https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod`

Get an access token (required for all API calls):

```bash
ACCESS_TOKEN=$(curl -s -u "5mbatc7uv35hr23qip437s2ai5:1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5" \
  -d "grant_type=client_credentials&scope=https://deep-copy.api/read https://deep-copy.api/write" \
  "https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token" | jq -r .access_token)
```

Then use `--header "Authorization: Bearer $ACCESS_TOKEN"` on all requests. Each endpoint group (v2/jobs, image-gen, swipe-files, prelander-images) has submit/status/result endpoints. See `infra/CLAUDE.md` for full endpoint examples and `infra/cdk/openapi.yaml` for the complete API spec.

## Development Workflow

Follow the "No Vibes" cycle in `.cursor/rules/`. Read `.cursor/rules/how-to-write-user-stories.mdc` before creating user stories.

## Deeper Context

For task-specific details, read the relevant subdirectory:
- `infra/CLAUDE.md` — infrastructure architecture, Lambda details, full API endpoint examples
- `.cursor/rules/` — development workflow, user story format
