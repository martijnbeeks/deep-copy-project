# Story US_06 — Update `llm_pricing.v1.json` with current vendor rates

**Status:** ✅ COMPLETED

**Role:** Platform/Infra Engineer

## Context
`scripts/llm_cost_report.py` computes USD cost from S3 JSONL usage events using `pricing/llm_pricing.v1.json`. Today, all configured rates are `0.0`, so cost reports are always zero.

Important limitation: the calculator supports only:
- Per-1M token rates for `input_token_1m`, `output_token_1m`, `cache_read_input_token_1m`, `cache_creation_input_token_1m`
- Per-image flat rate for `image_generation`

See cost computation logic:

```60:92:scripts/llm_cost_report.py
def compute_event_cost_usd(event: Dict[str, Any], rates: Dict[RateKey, float], strict: bool) -> float:
    provider = str(event.get("provider") or "")
    model = str(event.get("model") or "")
    if not provider or not model:
        return 0.0
    # ...
    input_tokens = int(event.get("inputTokens") or 0)
    output_tokens = int(event.get("outputTokens") or 0)
    cache_read = int(event.get("cacheReadInputTokens") or 0)
    cache_creation = int(event.get("cacheCreationInputTokens") or 0)
    images = int(event.get("imagesGenerated") or 0)

    cost = 0.0
    # Token costs are per 1M tokens
    if input_tokens:
        cost += (input_tokens / 1_000_000.0) * req("input_token_1m")
    if output_tokens:
        cost += (output_tokens / 1_000_000.0) * req("output_token_1m")
    if cache_read:
        cost += (cache_read / 1_000_000.0) * req("cache_read_input_token_1m")
    if cache_creation:
        cost += (cache_creation / 1_000_000.0) * req("cache_creation_input_token_1m")
    if images:
        cost += images * req("image_generation")
    return cost
```

## Goal
Populate `pricing/llm_pricing.v1.json` with real USD rates for the models/units we emit today, so `scripts/llm_cost_report.py` produces non-zero, reasonable cost outputs.

## Dependency
- None (pricing is an in-repo config file).

## Current Implementation (must change)

### 1) Pricing config exists but all USD values are 0.0
`pricing/llm_pricing.v1.json`:

```1:79:pricing/llm_pricing.v1.json
{
  "version": 1,
  "currency": "USD",
  "notes": "Edit this file to match your contracted model pricing. Costs are per 1M tokens unless specified otherwise.",
  "rates": [
    { "provider": "openai", "model": "gpt-5-mini", "unit": "input_token_1m", "usd": 0.0 },
    { "provider": "openai", "model": "gpt-5-mini", "unit": "output_token_1m", "usd": 0.0 },
    { "provider": "openai", "model": "gpt-4o", "unit": "input_token_1m", "usd": 0.0 },
    { "provider": "openai", "model": "gpt-4o", "unit": "output_token_1m", "usd": 0.0 },
    { "provider": "anthropic", "model": "claude-sonnet-4-5-20250929", "unit": "input_token_1m", "usd": 0.0 },
    { "provider": "anthropic", "model": "claude-sonnet-4-5-20250929", "unit": "output_token_1m", "usd": 0.0 },
    { "provider": "anthropic", "model": "claude-sonnet-4-5-20250929", "unit": "cache_read_input_token_1m", "usd": 0.0 },
    { "provider": "anthropic", "model": "claude-sonnet-4-5-20250929", "unit": "cache_creation_input_token_1m", "usd": 0.0 },
    { "provider": "google", "model": "gemini-3-pro-image-preview", "unit": "input_token_1m", "usd": 0.0 },
    { "provider": "google", "model": "gemini-3-pro-image-preview", "unit": "output_token_1m", "usd": 0.0 },
    { "provider": "openai", "model": "gpt-4o", "unit": "image_generation", "usd": 0.0 },
    { "provider": "google", "model": "gemini-3-pro-image-preview", "unit": "image_generation", "usd": 0.0 }
  ]
}
```

### 2) Image generation calls currently set `imagesGenerated = 1`
OpenAI image generation path:

```493:536:cdk/lib/lambdas/image_gen_process/handler.py
def _generate_image_openai(...):
    # ...
    model = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-4o")
    # ...
    resp = openai_client.responses.create(
        model=model,
        input=[{"role": "user", "content": content}],
        tools=[{"type": "image_generation"}],
        max_output_tokens=1000,
    )
    emit_llm_usage_event(
        # ...
        model=model,
        operation="responses.create",
        subtask="image_gen.generate_image_openai",
        # ...
        usage={**normalize_openai_usage(resp), "imagesGenerated": 1},
    )
```

This means any non-zero `image_generation` rate will be *added on top of* any token-based cost also present in the usage event.

## Desired Implementation (target state)
1. Update `pricing/llm_pricing.v1.json` `usd` values for each existing `{provider, model, unit}` to match current vendor pricing.
2. Make the image-generation pricing decision explicit:
   - Either set `image_generation` rates to `0.0` (token-only accounting), or
   - Set `image_generation` to a per-image USD value and accept that token costs may double-count unless the vendor bills images separately from usage tokens.

### Pricing decisions (validated)
- **OpenAI `gpt-5-mini`**: input `$0.25 / 1M`, output `$2.00 / 1M` (from OpenAI API pricing docs screenshot in this session).
- **OpenAI `gpt-4o`**: input `$2.50 / 1M`, output `$10.00 / 1M` (public OpenAI API pricing; token-only is used for this repo’s usage events).
- **OpenAI image generation**: **do not use** `gpt-4o` `image_generation` (set to `0.0`), per user instruction.
- **Anthropic `claude-sonnet-4-5-20250929`**: use **≤200k prompt tier**:
  - input `$3.00 / MTok`, output `$15.00 / MTok`
  - prompt caching: write `$3.75 / MTok`, read `$0.30 / MTok` (from user-provided Claude pricing screenshot).
- **Google `gemini-3-pro-image-preview` (Nano Banana Pro)**:
  - input text `$2.00 / 1M tokens` (also covers image inputs via token-equivalent accounting in `usage_metadata`)
  - output images: 1K/2K images are billed as **$0.134 per image** (use `image_generation` to represent this)
  - set `output_token_1m` to `0.0` to avoid double-counting image output tokens (this repo does not track separate “text output tokens vs image output tokens” for Gemini).

## Execution Phases

### Implementation (code written)
1. Update numeric `usd` values in `pricing/llm_pricing.v1.json` for:
   - OpenAI: `gpt-5-mini` input/output
   - OpenAI: `gpt-4o` input/output
   - Anthropic: `claude-sonnet-4-5-20250929` input/output/cache_read/cache_creation
   - Google: `gemini-3-pro-image-preview` input/output
   - Image generation: OpenAI `gpt-4o` and Google `gemini-3-pro-image-preview` (decision required)
2. Keep schema and keys unchanged (only numeric changes + possibly clarifying note text).

### Testing / Verification
1. Run `python3 scripts/llm_cost_report.py --help` (sanity check).
2. (Optional) Run `python3 scripts/llm_cost_report.py --bucket <BUCKET> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> --strict` and confirm the output `grandTotalUsd > 0` for a date range with usage events.

## Task

### Implementation (code written)
1. Confirm the desired mapping for `gemini-3-pro-image-preview` to a public pricing tier (if this model is not listed explicitly in official pricing docs).
2. Confirm whether to set `image_generation` rates to `0.0` (token-only) or to a per-image USD figure (and which quality/size assumptions).
3. Apply the agreed numeric updates to `pricing/llm_pricing.v1.json`.

### Testing / Verification
4. Run the report script with `--strict` against a real bucket/date range to ensure no missing rates.

## Constraints
- No schema changes: do not rename `unit` values or add new units in this story.
- No scope expansion into instrumentation changes; pricing-only.

## Acceptance Criteria
- `pricing/llm_pricing.v1.json` has non-zero values for all token-rate units where official pricing exists.
- When running `scripts/llm_cost_report.py` against a date range with events, the resulting `grandTotalUsd` is non-zero and no missing-rate errors occur under `--strict` (given events only use configured models).
- The chosen approach for `image_generation` is documented in the story and reflected in the config.

## Files to Edit (Expected)
- `pricing/llm_pricing.v1.json`
- `user_stories/US_06_UPDATE_LLM_PRICING_V1.md`


