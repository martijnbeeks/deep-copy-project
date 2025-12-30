# Story US_12 — Enhanced Perplexity cost tracking with detailed metrics IMPLEMENTATION SUMMARY

## What changed
- **Pricing Configuration**: Updated `pricing/llm_pricing.v1.json` with detailed rates for all Perplexity Sonar models:
    - **Sonar Deep Research**: Input ($2/1M), Output ($8/1M), Citation ($2/1M), Search ($5/1K), Reasoning ($3/1M).
    - **Sonar Pro**, **Sonar Reasoning Pro**, **Sonar Reasoning**, and base **Sonar** models.
- **Telemetry Module**: Updated `llm_usage.py` in both `process_job` and `process_job_v2` Lambdas:
    - Expanded `normalize_perplexity_usage` to extract `citation_tokens`, `num_search_queries`, and `reasoning_tokens` from the Perplexity SDK response.
- **Report Script**: Enhanced `scripts/llm_cost_report.py`:
    - Added support for new cost units: `citation_token_1m`, `search_query_1k`, and `reasoning_token_1m`.
    - Updated the cost calculation logic to account for these three new dimensions.
    - Updated aggregation and reporting to include `citationTokens`, `searchQueries`, and `reasoningTokens` in the final JSON and CSV outputs.

## What did NOT change
- Existing logic for OpenAI, Anthropic, and Google/Gemini remains unaffected.
- The high-level structure of the report (`totals` and `events`) is preserved.

## Deviations from US
- None.

## New risks / tech debt
- The report now contains more fields, which increases the size of the JSON output slightly.
- The `searchQueries` metric is aggregated alongside tokens, so users should be aware that its unit in the `totals` section is discrete queries, while tokens are absolute counts.

