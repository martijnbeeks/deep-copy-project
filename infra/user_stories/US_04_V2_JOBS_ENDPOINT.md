# Story 04 — Add /v2/jobs API endpoint with new request/response format

**Status:** 🟠 CODE WRITTEN (NEEDS TESTING)

**Role:** Backend Developer

## Context

The `/jobs` endpoint (v1) was designed for a flow where customer avatars were provided upfront. In US_02, the `process_job` Lambda was refactored to support a new flow:
- General research step without requiring persona information
- Automatic avatar identification from deep research output
- Multiple avatars with marketing angles per avatar
- Necessary beliefs extraction

The v1 `/jobs` endpoint still accepts the old request format with `customer_avatars`. We need a `/v2/jobs` endpoint that:
1. Enforces the new request schema (no `customer_avatars`, uses `research_requirements`, `gender`, `location`)
2. Returns the new response format with `identified_avatars`, `avatar_sheet` (list), and `necessary_beliefs`
3. Maintains backward compatibility by keeping v1 endpoints unchanged

## Goal

Add `/v2/jobs`, `/v2/jobs/{id}`, `/v2/jobs/{id}/result`, and `/dev/v2/jobs` endpoints that use the new request/response format for the general research flow.

## Dependency

- US_02_GENERAL_RESEARCH_JOBS (completed) - The process_job Lambda already supports the new flow

## Current Implementation

### 1) CDK Stack (`cdk/lib/deep-copy-stack.ts`)

The current stack defines v1 endpoints:
- Line ~420-439: `/jobs` resource with POST/GET methods
- Line ~510-519: `/dev/jobs` resource

All endpoints use the same `submitLambda`, `getJobLambda`, and `getJobResultLambda`.

### 2) Submit Lambda (`cdk/lib/lambdas/submit_job.py`)

The current submit handler:
- Accepts any JSON body and passes it to the process Lambda
- Does not validate request schema
- Sets `dev_mode` based on path prefix `/dev`

### 3) OpenAPI Spec (`cdk/openapi.yaml`)

The current spec defines:
- `/jobs` endpoints with `SubmitJobRequest` schema (lines ~50-172)
- `SubmitJobRequest` allows both old (`customer_avatars`) and new (`research_requirements`, `gender`, `location`) fields

## Desired Implementation

### Structural Outcome

1. **New CDK Resources**:
   - `ProcessJobV2Lambda` - Separate Docker-based Lambda for v2 processing
   - `SubmitJobV2Lambda` - Submit handler that invokes ProcessJobV2Lambda
   - `/v2/jobs` POST endpoint → `submitJobV2Lambda`
   - `/v2/jobs/{id}` GET endpoint → `getJobLambda` (reuse existing)
   - `/v2/jobs/{id}/result` GET endpoint → `getJobResultLambda` (reuse existing)
   - `/dev/v2/jobs` POST endpoint → `submitJobV2Lambda` (dev mode)

2. **New Process Handler** (`process_job_v2/handler.py`):
   - Completely separate Lambda from v1
   - New flow: identify_avatars → complete_avatar_details → complete_necessary_beliefs
   - Returns multiple avatars and aggregated marketing angles

3. **New Submit Handler** (`submit_job_v2.py`):
   - Validates required fields: `sales_page_url`, `project_name`
   - Accepts optional fields: `research_requirements`, `gender`, `location`, `advertorial_type`
   - Rejects deprecated fields: `customer_avatars`, `persona`, `age_range`
   - Returns 400 error if validation fails
   - Invokes ProcessJobV2Lambda (not v1)

4. **OpenAPI Updates**:
   - Add `/v2/jobs`, `/v2/jobs/{id}`, `/v2/jobs/{id}/result` paths
   - Add `/dev/v2/jobs` path
   - Add `SubmitJobV2Request` schema with only new fields
   - Add `JobResultV2` schema with new response structure

### Naming Conventions

- Lambda handler file: `submit_job_v2.py`
- CDK construct ID: `SubmitJobV2Lambda`
- OpenAPI operation IDs: `submitJobV2`, `getJobV2`, `getJobResultV2`

## Execution Phases

### Phase 1: Implementation (code written)

#### Task 1: Create `submit_job_v2.py`
File: `cdk/lib/lambdas/submit_job_v2.py`

Create a new submit handler that:
- Validates required fields (`sales_page_url`, `project_name`)
- Accepts optional fields (`research_requirements`, `gender`, `location`, `advertorial_type`)
- Rejects deprecated fields with 400 error
- Sets `api_version: "v2"` in the payload for the process Lambda to detect

#### Task 2: Update CDK Stack
File: `cdk/lib/deep-copy-stack.ts`

Add:
- `SubmitJobV2Lambda` function using `submit_job_v2.handler`
- Grant permissions (invoke processJobLambda, read/write jobsTable)
- `/v2` resource under `api.root`
- `/v2/jobs` with POST method → `submitJobV2Lambda`
- `/v2/jobs/{id}` with GET method → `getJobLambda` (reuse)
- `/v2/jobs/{id}/result` with GET method → `getJobResultLambda` (reuse)
- `/dev/v2/jobs` with POST method → `submitJobV2Lambda`

#### Task 3: Update OpenAPI Spec
File: `cdk/openapi.yaml`

Add:
- `SubmitJobV2Request` schema (only new fields, no deprecated)
- `JobResultV2` schema referencing `AvatarList`, `IdentifiedAvatarList`, `necessary_beliefs`
- `/v2/jobs` path with POST operation
- `/v2/jobs/{id}` path with GET operation
- `/v2/jobs/{id}/result` path with GET operation
- `/dev/v2/jobs` path with POST operation

### Phase 2: Testing / Verification

1. Run `cd cdk && npm run build` - verify TypeScript compiles
2. Run `cdk synth` - verify CloudFormation template generates
3. Verify OpenAPI spec is valid YAML syntax

## Tasks

- [ ] 1. Create `submit_job_v2.py` with validation logic
- [ ] 2. Update `deep-copy-stack.ts` with v2 resources and endpoints
- [ ] 3. Update `openapi.yaml` with v2 paths and schemas
- [ ] 4. Build and verify CDK compiles (`npm run build`)
- [ ] 5. Verify CloudFormation template generates (`cdk synth`)

## Constraints

- Do not modify v1 endpoints or their behavior
- Reuse existing `getJobLambda` and `getJobResultLambda` for status/result endpoints
- Process Lambda already supports both flows; v2 submit should set `api_version: "v2"`

## Acceptance Criteria

- [ ] `POST /v2/jobs` accepts new request format and returns 202 with jobId
- [ ] `POST /v2/jobs` returns 400 if `customer_avatars` is provided
- [ ] `POST /v2/jobs` returns 400 if `sales_page_url` or `project_name` is missing
- [ ] `GET /v2/jobs/{id}` returns job status
- [ ] `GET /v2/jobs/{id}/result` returns job result with new fields
- [ ] `POST /dev/v2/jobs` works in dev mode
- [ ] CDK compiles and synthesizes without errors
- [ ] OpenAPI spec is valid

## Files to Edit (Expected)

- `cdk/lib/lambdas/submit_job_v2.py` (new file)
- `cdk/lib/deep-copy-stack.ts`
- `cdk/openapi.yaml`

