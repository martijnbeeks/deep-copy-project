# Story US_12 — Enhanced Perplexity cost tracking with detailed metrics
**Status:** ✅ COMPLETED
**Role:** Platform Engineer

## Context
Perplexity AI's "Sonar Deep Research" and other models have complex pricing structures involving input, output, citation, reasoning tokens, and discrete search queries. Our current tracking only supports basic input/output tokens.

## Goal
Update the usage tracking and cost reporting system to account for all Perplexity-specific pricing dimensions.

## Dependency
None

## Current Implementation (must change)

### 1) Simple Perplexity normalization in `llm_usage.py`
```python
def normalize_perplexity_usage(response: Any) -> Dict[str, Optional[int]]:
    return normalize_openai_usage(response)
```

### 2) Incomplete Perplexity rates in `pricing/llm_pricing.v1.json`
Currently only has placeholder $1.0 rates for input/output.

### 3) Missing calculation logic in `scripts/llm_cost_report.py`
`compute_event_cost_usd` only handles input, output, cache, and images.

## Desired Implementation (target state)
- `llm_usage.py` captures `citationTokens`, `searchQueries`, and `reasoningTokens`.
- `llm_pricing.v1.json` contains accurate rates from the provided pricing table:
    - **Sonar Deep Research**: Input $2/1M, Output $8/1M, Citations $2/1M, Searches $5/1K, Reasoning $3/1M.
    - **Sonar Pro**: Input $3/1M, Output $15/1M.
    - **Sonar Reasoning Pro**: Input $2/1M, Output $8/1M.
    - **Sonar Reasoning**: Input $1/1M, Output $5/1M.
    - **Sonar**: Input $1/1M, Output $1/1M.
- `scripts/llm_cost_report.py` calculates costs using these new dimensions.
- Total stats in the report include these new usage metrics.

## Execution Phases

### Implementation (code written)
1. Update `pricing/llm_pricing.v1.json` with the new rates.
2. Update `cdk/lib/lambdas/process_job/llm_usage.py` and `cdk/lib/lambdas/process_job_v2/llm_usage.py`.
3. Update `scripts/llm_cost_report.py` to handle the new metrics in cost calculation and aggregation.

### Testing / Verification
1. Verify `llm_cost_report.py --help` shows (implicitly) or the report JSON shows the new fields.

## Task
1. [ ] Update pricing config.
2. [ ] Update usage emission.
3. [ ] Update report script calculation.
4. [ ] Update report script aggregation/output.

## Constraints
- Ensure units in `llm_pricing.v1.json` match the logic in `llm_cost_report.py` (e.g. `search_query_1k` vs `search_query`).

## Files to Edit (Expected)
- `pricing/llm_pricing.v1.json`
- `cdk/lib/lambdas/process_job/llm_usage.py`
- `cdk/lib/lambdas/process_job_v2/llm_usage.py`
- `scripts/llm_cost_report.py`

