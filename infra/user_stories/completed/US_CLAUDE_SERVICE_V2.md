# Story US_CLAUDE_SERVICE_V2 — Add ClaudeService for process_job_v2 Lambda

**Status:** ✅ COMPLETED

**Role:** Backend Developer

---

## Context

The `process_job_v2` Lambda currently uses `OpenAIService` for LLM interactions. To enable easy swapping between AI models in the future, a `ClaudeService` is needed that mirrors the `OpenAIService` interface while using Claude's streaming API (preferred for long-running jobs).

---

## Goal

Create a `ClaudeService` in `process_job_v2` that:
1. Mirrors the `OpenAIService` API for easy model swapping
2. Uses streaming for all requests (as Claude prefers for long-running jobs)
3. Integrates with existing telemetry (`emit_llm_usage_event`, `normalize_anthropic_usage`)
4. Includes retry logic with exponential backoff

---

## Dependency

None

---

## Current Implementation (must change)

### 1) Services directory structure
**File:** `cdk/lib/lambdas/process_job_v2/services/__init__.py` (lines 1-18)

Currently exports:
- `AWSServices`
- `OpenAIService`  
- `PerplexityService`
- `ResearchCacheService`

Missing: `ClaudeService`

### 2) No ClaudeService exists
**File:** Does not exist: `cdk/lib/lambdas/process_job_v2/services/claude_service.py`

### 3) No retry utility in process_job_v2
**File:** Does not exist: `cdk/lib/lambdas/process_job_v2/utils/retry.py`

Reference implementation exists at: `cdk/lib/lambdas/write_swipe/utils/retry.py`

---

## Desired Implementation (target state)

### 1) New ClaudeService class
**File:** `cdk/lib/lambdas/process_job_v2/services/claude_service.py`

- Class mirrors `OpenAIService` interface
- Constructor: `__init__(api_key, model, usage_ctx, aws_request_id)`
- Methods:
  - `set_usage_context(usage_ctx, aws_request_id)`
  - `create_response(content, subtask, model)` - streaming text response
  - `parse_structured(prompt, response_format, subtask, model)` - streaming with tool use for structured output
- Uses `client.messages.stream()` for all calls (per Claude best practices for long-running jobs)
- Emits telemetry via `emit_llm_usage_event()` with `provider="anthropic"`

### 2) Add retry utility
**File:** `cdk/lib/lambdas/process_job_v2/utils/retry.py`

Copy from `write_swipe/utils/retry.py` with proper imports adjusted.

### 3) Update exports
**File:** `cdk/lib/lambdas/process_job_v2/services/__init__.py`

Add `ClaudeService` to exports.

**File:** `cdk/lib/lambdas/process_job_v2/utils/__init__.py`

Add `retry_with_exponential_backoff` to exports.

---

## Execution Phases

### Implementation (code written)

- [ ] 1. Create `utils/retry.py` - copy from write_swipe and adjust imports
- [ ] 2. Update `utils/__init__.py` to export `retry_with_exponential_backoff`
- [ ] 3. Create `services/claude_service.py` with:
  - ClaudeService class
  - `create_response()` method using streaming
  - `parse_structured()` method using streaming + tool use
  - Telemetry integration
  - Retry logic
- [ ] 4. Update `services/__init__.py` to export `ClaudeService`

### Testing / Verification

- [ ] 5. Verify Python syntax: `python -m py_compile services/claude_service.py`
- [ ] 6. Verify imports work: `python -c "from services import ClaudeService"`

---

## Constraints

- Must use streaming API (`client.messages.stream()`) for all Claude calls
- Must maintain API compatibility with OpenAIService for easy swapping
- No changes to existing pipeline steps in this US

---

## Acceptance Criteria

1. `ClaudeService` class exists at `services/claude_service.py`
2. `ClaudeService` is importable from `services` package
3. `ClaudeService` has methods: `set_usage_context()`, `create_response()`, `parse_structured()`
4. All methods use streaming via `client.messages.stream()`
5. Telemetry emits with `provider="anthropic"`
6. Python syntax is valid (`py_compile` passes)

---

## Files to Edit (Expected)

- `cdk/lib/lambdas/process_job_v2/utils/retry.py` (CREATE)
- `cdk/lib/lambdas/process_job_v2/utils/__init__.py` (EDIT)
- `cdk/lib/lambdas/process_job_v2/services/claude_service.py` (CREATE)
- `cdk/lib/lambdas/process_job_v2/services/__init__.py` (EDIT)
