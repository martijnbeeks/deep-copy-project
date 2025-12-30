# US_06 — IMPLEMENTATION_SUMMARY

## What changed

- `pricing/llm_pricing.v1.json`
  - Set OpenAI token rates:
    - `openai:gpt-5-mini` input `$0.25 / 1M`, output `$2.00 / 1M`
    - `openai:gpt-4o` input `$2.50 / 1M`, output `$10.00 / 1M`
  - Set Anthropic Sonnet 4.5 (≤200k prompt tier) rates:
    - input `$3.00 / 1M`, output `$15.00 / 1M`
    - cache read `$0.30 / 1M`, cache creation/write `$3.75 / 1M`
  - Set Gemini 3 Pro Image Preview (“Nano Banana Pro”) rates aligned to 1K/2K outputs:
    - input `$2.00 / 1M` (text + image inputs via token-equivalent accounting)
    - output tokens set to `0.0` (avoid double-counting image output tokens)
    - `image_generation` set to `$0.134 / image` (1K/2K)
  - Per your instruction: **kept OpenAI `gpt-4o` `image_generation` at `0.0`**.

- `user_stories/US_06_UPDATE_LLM_PRICING_V1.md`
  - Marked story **🟢 READY** and recorded the pricing decisions/assumptions used.

## What did NOT change (and why)
- No changes to `scripts/llm_cost_report.py` cost formula:
  - Kept the existing `{provider, model, unit}` lookup contract unchanged.
  - Reason: scope is pricing-only; changing units would break historical reports and the established schema.
- No changes to LLM usage event emission (`llm_usage.py`) or to how `imagesGenerated` is recorded.
  - Reason: requested scope is updating pricing config only.

## Verification performed
- Ran `python3 scripts/llm_cost_report.py --help` successfully (CLI sanity check).

## Deviations from the US
- None.

## New risks / tech debt
- Gemini 3 Pro Image Preview output token billing vs image billing:
  - We set `google:gemini-3-pro-image-preview` `output_token_1m` to `0.0` to avoid double-counting, because events do not separate “text output tokens” from “image output tokens”.
  - If future Gemini calls return substantial **text output** alongside images, current reporting will undercount that text portion unless we extend the event schema or split token counters.


