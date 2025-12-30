# Story US_05 — Collect LLM usage and compute cost-per-run across endpoints and subtasks
**Status:** 🟠 CODE WRITTEN (NEEDS TESTING)

**Role:** Platform/Infra Engineer

## Context
We currently invoke multiple LLM providers (OpenAI, Anthropic, Google/Gemini) across multiple API endpoints and async subtasks, but we do **not** emit a unified “usage event” per model call. This makes it hard to:
- Attribute cost to a single API request/job run
- Break down cost by endpoint and subtask (for pricing model inputs)
- Compare providers/models over time

## Goal
Capture provider usage (tokens/images), latency, and error metadata for **every LLM call** and reliably attribute it to:
- The originating **endpoint** (e.g. `POST /v2/jobs`)
- The **job run** (`jobId`)
- The **subtask** (e.g. `image-gen`, `swipe-files`, avatar extraction, specific pipeline step)

Then provide a repeatable way to compute and export **cost per run** and **cost breakdowns** suitable as inputs for our pricing model.

## Dependency
- AWS: Lambda, CloudWatch Logs, DynamoDB, S3 (existing results bucket)
- CDK stack changes in `cdk/lib/deep-copy-stack.ts`
- In-repo pricing config: `pricing/llm_pricing.v1.json`

## Current Implementation (must change)

### 1) V2 jobs create job metadata, but LLM usage is not captured
`cdk/lib/lambdas/submit_job_v2.py` creates `jobId`, stores `apiVersion=v2`, then invokes the processing lambda async.
- Example: `jobId`, `resultPrefix`, `apiVersion` persisted and passed onward. (`cdk/lib/lambdas/submit_job_v2.py:L99-L141`)

### 2) V2 processing invokes OpenAI + Anthropic, but does not emit usage/cost events
`cdk/lib/lambdas/process_job_v2/handler.py` initializes both clients and calls OpenAI via the Responses API.
- Client init: `OpenAI(...)` and `anthropic.Anthropic(...)` (`cdk/lib/lambdas/process_job_v2/handler.py:L336-L351`)
- OpenAI calls (examples):
  - Vision page analysis: `self.client.responses.create(...)` (`cdk/lib/lambdas/process_job_v2/handler.py:L392-L401`)
  - Structured parsing: `self.client.responses.parse(...)` (`cdk/lib/lambdas/process_job_v2/handler.py:L519-L531`)
- Today: response usage is not extracted and no structured “usage event” is written.

### 3) Image generation uses OpenAI + Gemini, but usage/cost attribution is missing
`cdk/lib/lambdas/submit_image_gen.py` creates a job record with `jobType=IMAGE_GEN` and invokes the docker lambda async. (`cdk/lib/lambdas/submit_image_gen.py:L51-L89`)

`cdk/lib/lambdas/image_gen_process/handler.py`:
- OpenAI usage paths:
  - `openai_client.chat.completions.create(...)` (`cdk/lib/lambdas/image_gen_process/handler.py:L307-L323` and `L403-L428`)
  - `openai_client.responses.create(... image_generation ...)` (`cdk/lib/lambdas/image_gen_process/handler.py:L445-L477`)
- Gemini usage path:
  - `genai.GenerativeModel("gemini-3-pro-image-preview").generate_content(...)` (`cdk/lib/lambdas/image_gen_process/handler.py:L480-L516`)
- Today: token/image usage is not emitted in a unified way, and there is no cost-per-run output.

### 4) Swipe-file generation logs Anthropic usage, but not as structured cost events
`cdk/lib/lambdas/write_swipe/swipe_file_writer.py` already captures `message.usage` and logs token usage to CloudWatch.
- Streaming usage extraction: `message = stream.get_final_message(); usage_data = message.usage` (`cdk/lib/lambdas/write_swipe/swipe_file_writer.py:L372-L410`)
- Today: the data is not normalized across providers nor persisted in a queryable store keyed by `jobId`/endpoint/subtask.

### 5) Avatar extraction uses OpenAI Vision, but no usage/cost event exists
`cdk/lib/lambdas/extract_avatars/avatar_extractor.py` calls OpenAI from `extract_avatars_from_url(...)`. (`cdk/lib/lambdas/extract_avatars/avatar_extractor.py:L187-L204`)
- Today: no consistent usage event is emitted for these calls.

## Desired Implementation (target state)

### A) Define a single “LLM Usage Event” schema (provider-agnostic)
Create a schema (JSON) that is emitted once per provider call (and optionally once per retry attempt) with **no prompt/user content** stored.

Minimum required fields:
- **identity**
  - `eventVersion` (e.g. `1`)
  - `eventId` (uuid)
  - `timestamp` (UTC ISO)
  - `awsRequestId` (Lambda request id if available)
- **attribution**
  - `endpoint` (e.g. `POST /v2/jobs`, `POST /image-gen/generate`, `POST /swipe-files/generate`, `POST /avatars/extract`)
  - `jobId`
  - `jobType` (e.g. `V2_JOB`, `IMAGE_GEN`, `SWIPE_FILES`, `AVATAR_EXTRACTION`)
  - `apiVersion` (e.g. `v2` when known)
  - `projectName` (string; when available from request payloads such as V2 jobs)
  - `subtask` (stable slug; examples: `process_job_v2.analyze_research_page`, `image_gen.match_angles_to_images`, `write_swipe.turn1_style_guide`)
- **provider**
  - `provider` in `{openai, anthropic, google}`
  - `model`
  - `operation` (e.g. `responses.create`, `responses.parse`, `chat.completions.create`, `messages.stream`, `generate_content`)
- **usage**
  - `inputTokens`, `outputTokens`
  - `cacheReadInputTokens`, `cacheCreationInputTokens` (Anthropic where present)
  - `imagesGenerated` / `imageBytesOut` (where relevant)
- **performance & outcome**
  - `latencyMs`
  - `success` boolean
  - `errorType` / `httpStatus` (best-effort)
  - `retryAttempt` (int)

### B) Centralize emission: a tiny shared helper used by all lambdas
Add a small shared module (no heavy deps) that:
- Normalizes provider-specific usage objects into the schema above
- Emits a single JSON object to:
  - **S3 JSONL** in the existing results bucket (primary analytics store)
  - (CloudWatch logs remain, but are not the primary analytics store)

S3 writing requirements:
- Write usage events as JSON Lines, partitioned by time for querying (e.g. `llm_usage_events/dt=YYYY-MM-DD/hour=HH/...jsonl`)
- Retention: **forever** (no TTL deletion of raw usage events)

### C) Create cost calculation outputs for pricing model inputs
Add a versioned pricing config file (repo-managed) and a reporting script that produces:
- **Cost per run**: total cost per `jobId`
- **Cost by endpoint**: aggregate over time windows
- **Cost by subtask**: top contributors per run and across runs
- Export formats: `json` and `csv`

Pricing config requirements:
- Map `provider + model + unit` → USD rates (tokens, cached tokens, images)
- Include effective date/version so historical runs remain reproducible
- Store config **in-repo** (manual updates; version-controlled)

### D) Instrumentation coverage (must be complete for our endpoints/subtasks)
At minimum, emit usage events for:
- `cdk/lib/lambdas/process_job_v2/handler.py` (all OpenAI calls; Anthropic calls if/when used)
- `cdk/lib/lambdas/process_job/handler.py` (all OpenAI calls; Anthropic calls if/when used)
- `cdk/lib/lambdas/image_gen_process/handler.py` (OpenAI + Gemini)
- `cdk/lib/lambdas/write_swipe/swipe_file_writer.py` (Anthropic)
- `cdk/lib/lambdas/extract_avatars/avatar_extractor.py` (OpenAI)

## Execution Phases

### Implementation (code written)
1. Wire S3 JSONL sink for LLM usage events:
   - Choose and document an S3 prefix under the existing results bucket (e.g. `llm_usage_events/`)
   - Ensure IAM `s3:PutObject` permissions for all relevant lambdas in `cdk/lib/deep-copy-stack.ts`
   - Add env vars as needed (e.g. `RESULTS_BUCKET` and `LLM_USAGE_EVENTS_PREFIX`)
2. Create shared usage emission module and provider normalizers.
3. Update each LLM call site to:
   - Measure latency
   - Extract provider usage metadata
   - Emit a usage event with endpoint/jobId/subtask attribution
4. Add pricing configuration file in-repo and a CLI/report script that:
   - Reads usage events for a given time range
   - Computes costs using the pricing config
   - Outputs `csv` + `json` for pricing-model ingestion

### Testing / Verification
- **Local static**:
  - Run `cdk/npm run build` and confirm TypeScript compiles.
  - Run `cdk synth` and confirm no missing permissions/env vars for modified lambdas.
    - Note: on this workstation `cdk synth` currently crashes under **Node.js v22** inside the CDK CLI’s staging copy step (fs-extra copy path). Recommended workaround is to run CDK under **Node 20 LTS**.
- **Functional**:
  - Trigger one run of each endpoint:
    - `POST /v2/jobs`
    - `POST /image-gen/generate`
    - `POST /swipe-files/generate`
    - `POST /avatars/extract`
  - Verify:
    - Usage events exist for each provider call (count > 0)
    - Events are queryable by `jobId`
    - Report script produces a total cost per run and a breakdown by subtask

## Task

### Implementation (code written)
1. Define and document the `LlmUsageEvent` JSON schema (including `projectName` attribution when available).
2. Implement the S3 JSONL sink wiring (CDK permissions + env vars) for all lambdas that will emit events.
3. Implement shared emitter + provider normalizers (OpenAI/Anthropic/Google).
4. Add instrumentation to all identified call sites (OpenAI/Anthropic/Gemini).
5. Add pricing config + reporting script and document expected outputs.

### Testing / Verification
6. Deploy to a dev environment and run one job per endpoint; verify events and report outputs.

## Constraints
- Do **not** store prompt text, full responses, customer URLs, or any PII in usage events.
- Emission must be best-effort: failure to write a usage event must **not** fail the job.
- Schema must be stable and versioned (`eventVersion`) to support pricing model evolution.
- Scope is **OpenAI + Anthropic + Google** only (Perplexity is present but out-of-scope for this story).
- Storage sink is **S3 JSONL** with **forever retention**.
- Granularity is **event-based**: emit one usage event per provider call attempt (including retries), keyed by `retryAttempt`.
- Primary attribution dimension is `projectName` when available (e.g. V2 jobs).

## Acceptance Criteria
- For each of these endpoints, at least one end-to-end run produces persisted usage events attributable to the run:
  - `POST /v2/jobs`
  - `POST /image-gen/generate`
  - `POST /swipe-files/generate`
  - `POST /avatars/extract`
- For a given `jobId`, we can produce:
  - Total estimated cost (USD)
  - Breakdown by `provider`, `model`, and `subtask`
- A report command outputs `json` and `csv` suitable as input for the pricing model.

## Files to Edit (Expected)
- `cdk/lib/deep-copy-stack.ts`
- `cdk/lib/lambdas/process_job_v2/handler.py`
- `cdk/lib/lambdas/process_job/handler.py`
- `cdk/lib/lambdas/image_gen_process/handler.py`
- `cdk/lib/lambdas/write_swipe/swipe_file_writer.py`
- `cdk/lib/lambdas/extract_avatars/avatar_extractor.py`
- `cdk/lib/lambdas/**/llm_usage.py` (copied into each Docker lambda build context)
- `pricing/llm_pricing.v1.json`
- `scripts/llm_cost_report.py`

## Decisions captured for approval
- **Storage choice**: **S3 JSONL**
- **Retention**: **forever**
- **Pricing source**: **config in repo**
- **Granularity**: **event-based** (per call attempt)
- **Attribution**: **projectName is fine**

Attribution note:
- `projectName` is **optional** and will be omitted/empty for endpoints that do not supply it (e.g. `/avatars/extract`, `/swipe-files/generate`, `/image-gen/generate`).


