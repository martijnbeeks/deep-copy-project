# Story US_10 — Include usage metrics and average costs in LLM cost report
**Status:** ✅ COMPLETED
**Role:** Platform Engineer

## Context
The current `scripts/llm_cost_report.py` only aggregates the total USD cost per dimension (job, endpoint, subtask, etc.). To better understand unit economics and pricing, we need to see the actual usage (tokens, images) and the average cost per call.

## Goal
Enhance the reporting script to aggregate usage metrics and calculate average costs per API call across all dimensions.

## Dependency
None

## Current Implementation (must change)

### 1) Simple cost aggregation in `scripts/llm_cost_report.py`
```python:144:147:scripts/llm_cost_report.py
    per_job = defaultdict(float)
    per_endpoint = defaultdict(float)
    per_subtask = defaultdict(float)
    per_provider_model = defaultdict(float)
```

### 2) Totals section in JSON report
```python:197:203:scripts/llm_cost_report.py
        "totals": {
            "perJobIdUsd": dict(sorted(per_job.items(), key=lambda x: -x[1])),
            "perEndpointUsd": dict(sorted(per_endpoint.items(), key=lambda x: -x[1])),
            "perSubtaskUsd": dict(sorted(per_subtask.items(), key=lambda x: -x[1])),
            "perProviderModelUsd": dict(sorted(per_provider_model.items(), key=lambda x: -x[1])),
            "grandTotalUsd": round(sum(per_job.values()), 10),
        },
```

## Desired Implementation (target state)
- Aggregates `costUsd`, `callCount`, `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`, and `imagesGenerated` for each dimension.
- Calculates `avgCostUsd` (Total Cost / Call Count) for each dimension.
- The `totals` section in the JSON output contains these detailed metrics instead of just a single float.
- Dimensions remain: `perJobId`, `perEndpoint`, `perSubtask`, and `perProviderModel`.

## Execution Phases

### Implementation (code written)
1. Redefine aggregation structures in `scripts/llm_cost_report.py`.
2. Update the event processing loop to accumulate all usage metrics.
3. Add a post-processing step to calculate averages and format the `totals` section.

### Testing / Verification
1. Run the script and verify `llm_cost_report.json` contains the new metrics.
2. Confirm `grandTotalUsd` remains accurate.

## Task
1. [x] Update aggregation logic in `scripts/llm_cost_report.py`.
2. [x] Include usage metrics and average cost in JSON output.

## Constraints
- Maintain backward compatibility for the CSV output if possible (or update it to include these metrics).

## Acceptance Criteria
- `llm_cost_report.json` includes `callCount`, `inputTokens`, `outputTokens`, and `avgCostUsd` for each dimension in `totals`.
- Averages are correctly calculated (Total Cost / Total Calls).

## Files to Edit (Expected)
- `scripts/llm_cost_report.py`

