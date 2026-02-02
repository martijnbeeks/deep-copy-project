# Story US_09 — Update llm_cost_report.py with repository-specific defaults
**Status:** ✅ COMPLETED
**Role:** Platform Engineer

## Context
The `scripts/llm_cost_report.py` script currently requires several command-line arguments (bucket, start-date, end-date) that are redundant for common use cases in this repository. 

## Goal
Simplify the execution of `scripts/llm_cost_report.py` by setting defaults that match the repository's configuration and current date.

## Dependency
None

## Current Implementation (must change)

### 1) Required arguments in `scripts/llm_cost_report.py`
```python:126:129:scripts/llm_cost_report.py
    ap.add_argument("--bucket", required=True, help="S3 bucket containing usage events (RESULTS_BUCKET)")
    ap.add_argument("--prefix", default="llm_usage_events", help="S3 prefix for JSONL events")
    ap.add_argument("--start-date", required=True, help="YYYY-MM-DD (inclusive)")
    ap.add_argument("--end-date", required=True, help="YYYY-MM-DD (inclusive)")
```

## Desired Implementation (target state)
- `bucket` defaults to `deepcopystack-resultsbucketa95a2103-zhwjflrlpfih`.
- `start_date` defaults to the current date in `YYYY-MM-DD` format.
- `end_date` defaults to the current date in `YYYY-MM-DD` format.
- All other arguments remain with their current defaults.

## Execution Phases

### Implementation (code written)
1. Update `scripts/llm_cost_report.py` to make `bucket`, `start-date`, and `end-date` optional with the specified defaults.

### Testing / Verification
1. Run `python3 scripts/llm_cost_report.py --help` to verify the new defaults.
2. Run `python3 scripts/llm_cost_report.py` (without arguments) to ensure it executes using defaults.

## Task
1. [x] Update `scripts/llm_cost_report.py` defaults.

## Constraints
None

## Acceptance Criteria
- `scripts/llm_cost_report.py` can be run without any arguments.
- Default bucket is `deepcopystack-resultsbucketa95a2103-zhwjflrlpfih`.
- Default dates are the current date.

## Files to Edit (Expected)
- `scripts/llm_cost_report.py`

