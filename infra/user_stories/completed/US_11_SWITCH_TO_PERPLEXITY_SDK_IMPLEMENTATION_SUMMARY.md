# Story US_11 — Switch to perplexityai package for Perplexity API calls IMPLEMENTATION SUMMARY

## What changed
- **SDK Integration**: Replaced manual `requests` calls with the official `perplexityai` Python SDK in `process_job` and `process_job_v2` Lambda handlers.
- **Dependency Management**: Added `perplexityai>=0.1.0` to `pyproject.toml` in both `cdk/lib/lambdas/process_job/` and `cdk/lib/lambdas/process_job_v2/`.
- **Usage Tracking**: 
    - Added `normalize_perplexity_usage` to `llm_usage.py` (supporting OpenAI-compatible usage shapes).
    - Integrated usage emission in `execute_deep_research` via `_emit_perplexity`.
- **Cost Reporting**: Added Perplexity models (`sonar-deep-research`, `sonar-pro`) to `pricing/llm_pricing.v1.json` with placeholder rates ($1.0/1M tokens).
- **Handler Refactoring**:
    - Initialized `Perplexity` client alongside `OpenAI` and `Anthropic` clients in `LambdaHandler.__init__`.
    - Simplified `execute_deep_research` logic using the SDK's `chat.completions.create`.

## What did NOT change
- The research prompt logic and model names remain the same.
- Other provider calls (OpenAI, Anthropic) were not modified except for initialization.

## Deviations from US
- None.

## New risks / tech debt
- The `perplexityai` package is now a required dependency for these Docker-based Lambdas.
- Placeholder pricing for Perplexity should be updated with actual contract rates once available.

