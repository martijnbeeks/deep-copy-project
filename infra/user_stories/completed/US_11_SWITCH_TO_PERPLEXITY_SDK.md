# Story US_11 — Switch to perplexityai package for Perplexity API calls
**Status:** ✅ COMPLETED
**Role:** Platform Engineer

## Context
Currently, Perplexity API calls are made using the `requests` library with manual URL and header management. This is inconsistent with how other providers (OpenAI, Anthropic, Google) are handled via their respective SDKs. Furthermore, Perplexity calls are not currently tracked in the LLM cost report.

## Goal
Switch to the official `perplexityai` Python SDK for all Perplexity API calls and integrate them into the LLM usage tracking system.

## Dependency
- `perplexityai` package
- `pricing/llm_pricing.v1.json` update

## Current Implementation (must change)

### 1) Manual requests in `cdk/lib/lambdas/process_job_v2/handler.py` and `cdk/lib/lambdas/process_job/handler.py`
```python
            url = "https://api.perplexity.ai/chat/completions"
            resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=1000)
```

### 2) Missing Perplexity normalization in `llm_usage.py`
There is no `normalize_perplexity_usage` in the shared telemetry module.

## Desired Implementation (target state)
- `perplexityai` added to `pyproject.toml` in `process_job` and `process_job_v2`.
- `llm_usage.py` includes `normalize_perplexity_usage` supporting OpenAI-compatible usage objects.
- `handler.py` in both lambdas uses `Perplexity` client from the `perplexityai` package.
- Perplexity calls emit usage events via `emit_llm_usage_event`.
- `pricing/llm_pricing.v1.json` includes `perplexity` provider and models (`sonar-deep-research`, `sonar-pro`) with placeholder rates.

## Execution Phases

### Implementation (code written)
1. Add `perplexityai` to `dependencies` in `cdk/lib/lambdas/process_job/pyproject.toml` and `cdk/lib/lambdas/process_job_v2/pyproject.toml`.
2. Implement `normalize_perplexity_usage` in `cdk/lib/lambdas/process_job/llm_usage.py` and `cdk/lib/lambdas/process_job_v2/llm_usage.py`.
3. Refactor `execute_deep_research` in both `handler.py` files to use the `Perplexity` client and call the telemetry emitter.
4. Update `pricing/llm_pricing.v1.json`.

### Testing / Verification
1. Run `cdk synth` (with Node 20) to ensure build context is valid (mocked).
2. Verify usage events are emitted in local tests if possible.

## Task
1. [x] Update dependencies.
2. [x] Update telemetry normalization.
3. [x] Refactor handlers.
4. [x] Update pricing config.

## Constraints
- Maintain the same model names and behavior.
- Ensure best-effort emission (never fail the job if telemetry fails).

## Files to Edit (Expected)
- `cdk/lib/lambdas/process_job/pyproject.toml`
- `cdk/lib/lambdas/process_job_v2/pyproject.toml`
- `cdk/lib/lambdas/process_job/llm_usage.py`
- `cdk/lib/lambdas/process_job_v2/llm_usage.py`
- `cdk/lib/lambdas/process_job/handler.py`
- `cdk/lib/lambdas/process_job_v2/handler.py`
- `pricing/llm_pricing.v1.json`

