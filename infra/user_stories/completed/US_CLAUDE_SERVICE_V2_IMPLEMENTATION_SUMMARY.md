# Implementation Summary: US_CLAUDE_SERVICE_V2

## What Changed

### 1. `cdk/lib/lambdas/process_job_v2/utils/retry.py` (CREATED)
- Added `retry_with_exponential_backoff()` utility function
- Provides retry logic with configurable delay, jitter, and max retries
- Copied and adapted from `write_swipe` Lambda implementation

### 2. `cdk/lib/lambdas/process_job_v2/utils/__init__.py` (MODIFIED)
- Added import of `retry_with_exponential_backoff`
- Added `retry_with_exponential_backoff` to `__all__` exports

### 3. `cdk/lib/lambdas/process_job_v2/services/claude_service.py` (CREATED)
- New `ClaudeService` class mirroring `OpenAIService` API
- Constructor: `__init__(api_key, model, usage_ctx, aws_request_id)`
- Method: `set_usage_context(usage_ctx, aws_request_id)`
- Method: `create_response(content, subtask, model, max_tokens, system_prompt)` - streaming text response
- Method: `parse_structured(prompt, response_format, subtask, model, max_tokens, system_prompt)` - streaming with tool use for Pydantic model output
- All API calls use `client.messages.stream()` as recommended by Claude for long-running jobs
- Full telemetry integration with `emit_llm_usage_event()` using `provider="anthropic"`
- Retry logic via `retry_with_exponential_backoff()`
- Default model: `claude-sonnet-4-5-20250929`

### 4. `cdk/lib/lambdas/process_job_v2/services/__init__.py` (MODIFIED)
- Added import of `ClaudeService`
- Added `ClaudeService` to `__all__` exports
- Updated docstring to mention Claude

---

## What Did NOT Change (and Why)

### Pipeline Orchestrator (`pipeline/orchestrator.py`)
- Not modified per US scope - this US only adds the service, not integration
- Integration into pipeline requires a separate US to determine which steps should use Claude vs OpenAI

### Existing llm_usage.py
- Already had `normalize_anthropic_usage()` function - no changes needed

### pyproject.toml
- Already had `anthropic>=0.72.0` dependency - no changes needed

---

## Deviations from US

None. Implementation followed the plan exactly.

---

## New Risks / Tech Debt

1. **Model swapping not automated**: Currently the orchestrator still uses `OpenAIService`. A future US should add configuration to select between OpenAI and Claude services.

2. **Tool use schema handling**: The `parse_structured()` method includes `$defs` for nested Pydantic models, but complex deeply-nested schemas may need additional testing with Claude's tool use.

3. **Default model**: Using `claude-sonnet-4-5-20250929` as default. This should be reviewed/updated as newer models become available.
