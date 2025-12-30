# Story US_07 — Migrate nano_banana to google-genai and set image_size to 1K

**Status:** ✅ COMPLETED

**Role:** Platform engineer (Deep Copy infra)

### Context

`nano_banana` image generation currently uses the legacy Python SDK `google-generativeai` inside the `image_gen_process` Lambda. We need to migrate to the new **Google Gen AI SDK** (`google-genai`) and explicitly set **`image_size` to `1K`** (uppercase K), per the Gemini image generation docs.

SDK reference for the target library: `https://googleapis.github.io/python-genai/` (installation/imports and `GenerateContentConfig` / `ImageConfig`).  
Gemini image generation behavior (1K/2K/4K + uppercase K requirement): `https://ai.google.dev/gemini-api/docs/image-generation`.

### Goal

When `imageGenerationProvider` is `nano_banana`, the image generation path uses `google-genai` and sends an image generation request that sets `image_size="1K"`, returning a base64-encoded PNG as before and continuing to emit LLM usage telemetry.

### Dependency

- Google Gen AI SDK docs: `https://googleapis.github.io/python-genai/`
- Gemini image generation docs (image size rules): `https://ai.google.dev/gemini-api/docs/image-generation`

### Current Implementation (must change)

### 1) Dependency uses the legacy SDK

`cdk/lib/lambdas/image_gen_process/pyproject.toml`:

- `google-generativeai` is included as a dependency:
  - `google-generativeai>=0.8.0` (`cdk/lib/lambdas/image_gen_process/pyproject.toml:L7-L14`)

`cdk/lib/lambdas/image_gen_process/uv.lock`:

- Lockfile pins `google-generativeai==0.8.6`:
  - `name = "google-generativeai"` (`cdk/lib/lambdas/image_gen_process/uv.lock:L304-L321`)

### 2) Handler imports and uses `google.generativeai`

`cdk/lib/lambdas/image_gen_process/handler.py` imports:

- `import google.generativeai as genai` (`handler.py:L47`)
- `import google.generativeai.types as genai_types` (`handler.py:L48`)

### 3) nano_banana generation path does not set image size and manually scrapes response shape

`cdk/lib/lambdas/image_gen_process/handler.py`:

- Config + call:
  - `genai.configure(api_key=api_key)` (`handler.py:L569`)
  - `model = genai.GenerativeModel(model_name)` (`handler.py:L579`)
  - `resp = model.generate_content(contents)` (`handler.py:L581`)
- Image bytes extraction is best-effort via `resp.candidates[*].content.parts[*].inline_data.data` (`handler.py:L607-L621`)

### Desired Implementation (target state)

### 1) Replace legacy SDK with Google Gen AI SDK

Update `cdk/lib/lambdas/image_gen_process/pyproject.toml` dependencies:

- Remove `google-generativeai>=...`
- Add `google-genai>=...` (version pinned/validated during implementation)

Update `cdk/lib/lambdas/image_gen_process/uv.lock` accordingly so Docker builds remain `--frozen` (see `Dockerfile:L15-L18`).

### 2) Use the new client + types APIs for image generation

In `cdk/lib/lambdas/image_gen_process/handler.py`:

- Replace old imports with:
  - `from google import genai`
  - `from google.genai import types`
- Replace `genai.configure(...)` and `genai.GenerativeModel(...)` usage with a `genai.Client(...)` and `client.models.generate_content(...)` per the SDK docs (`https://googleapis.github.io/python-genai/`).

### 3) Set `image_size="1K"` for nano_banana requests (uppercase K)

Implement `image_size` using the SDK’s `ImageConfig.image_size` as part of `GenerateContentConfig`:

- `config=types.GenerateContentConfig(..., image_config=types.ImageConfig(image_size="1K", output_mime_type="image/png"))`

Additionally:

- `image_size` is **hardcoded** to `"1K"` (uppercase K). (Gemini docs reject lowercase, e.g. `1k`).

### 4) Keep telemetry, and ensure response parsing works with the new SDK

- Ensure the returned response still yields the first image bytes and converts them to base64 (PNG) for the existing Cloudflare upload path.
- Update `normalize_gemini_usage(...)` (in `cdk/lib/lambdas/image_gen_process/llm_usage.py`) if the new SDK response shape differs from the current best-effort `usage_metadata` extraction.

### Execution Phases (required)

#### Implementation (code written)

1. Update `cdk/lib/lambdas/image_gen_process/pyproject.toml` to use `google-genai` and remove `google-generativeai`.
2. Update `cdk/lib/lambdas/image_gen_process/uv.lock` to reflect the new dependency set (keeping Docker installs frozen).
3. Update `cdk/lib/lambdas/image_gen_process/handler.py`:
   - Replace imports (`google.generativeai` → `google.genai`).
   - Create a `genai.Client()` (Gemini Developer API via env `GOOGLE_API_KEY`/`GEMINI_API_KEY`).
   - Call `client.models.generate_content(...)` for `model_name="gemini-3-pro-image-preview"`.
   - Pass `config=types.GenerateContentConfig(response_modalities=["IMAGE"], image_config=types.ImageConfig(image_size="1K", output_mime_type="image/png"))`.
   - Parse the returned image bytes in a deterministic way (first image part) and base64-encode.
4. Update `cdk/lib/lambdas/image_gen_process/llm_usage.py` only if necessary to keep usage extraction working for the new response objects.

#### Testing / Verification

1. Static checks:
   - `python -m py_compile cdk/lib/lambdas/image_gen_process/handler.py`
2. Dependency build sanity:
   - `docker build -t deepcopy-image-gen-process cdk/lib/lambdas/image_gen_process` (must succeed; uses `uv export --frozen`).
3. (Manual, requires API key) Runtime smoke test:
   - Run a small local script to call `_generate_image_nano_banana(...)` and verify:
     - Returns base64 string
     - Decoded bytes are a valid PNG header

### Task

- Implementation (code written)
  1. Replace Python dependency from `google-generativeai` → `google-genai` in `pyproject.toml`.
  2. Regenerate `uv.lock` to match dependency change.
  3. Update `handler.py` nano_banana path to use `genai.Client` + `types.GenerateContentConfig(... image_config=types.ImageConfig(image_size="1K"))`.
  4. Ensure response parsing returns base64 PNG reliably for the new SDK response object.
  5. Keep LLM usage emission intact (update `llm_usage.py` only if required).

- Testing / Verification
  6. Run `py_compile` on `handler.py`.
  7. Run a Docker build for the lambda image to ensure frozen lock installs succeed.
  8. Optional manual runtime smoke test with API key.

### Constraints

- No API contract change in this story (no OpenAPI changes / no new request fields).
- No scope expansion beyond the `image_gen_process` lambda and only the minimum supporting changes for telemetry/build.

### Acceptance Criteria

- `cdk/lib/lambdas/image_gen_process/pyproject.toml` no longer depends on `google-generativeai` and instead depends on `google-genai`.
- `cdk/lib/lambdas/image_gen_process/handler.py` no longer imports `google.generativeai`.
- The nano_banana generation request explicitly sets **`image_size="1K"`** (uppercase K).
- The function still returns base64-encoded PNG bytes and uploads successfully (no change to output contract).
- Docker build for `cdk/lib/lambdas/image_gen_process` succeeds with `uv ... --frozen`.

### Files to Edit (Expected)

- `cdk/lib/lambdas/image_gen_process/pyproject.toml`
- `cdk/lib/lambdas/image_gen_process/uv.lock`
- `cdk/lib/lambdas/image_gen_process/handler.py`
- `cdk/lib/lambdas/image_gen_process/llm_usage.py`


