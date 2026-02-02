# Story US_08 — Fix unsupported output_mime_type in Gemini image generation

**Status:** ✅ COMPLETED

**Role:** Platform engineer (Deep Copy infra)

### Context

After migrating to the new `google-genai` SDK in US_07, image generation with `nano_banana` (Gemini 3 Pro Image) fails with the error:
`error=output_mime_type parameter is not supported in Gemini API.`

This indicates that while the `google-genai` SDK `ImageConfig` type includes `output_mime_type`, the underlying Gemini Developer API does not support this parameter for the `gemini-3-pro-image-preview` model.

### Goal

Successfully generate 1K images using Gemini 3 Pro Image without the `output_mime_type` error.

### Dependency

- Gemini image generation docs: `https://ai.google.dev/gemini-api/docs/image-generation`
- US_07 implementation (previous migration)

### Current Implementation (must change)

`cdk/lib/lambdas/image_gen_process/handler.py`:

```python
   624|            config=types.GenerateContentConfig(
   625|                response_modalities=["IMAGE"],
   626|                image_config=types.ImageConfig(
   627|                    image_size=image_size,
   628|                    output_mime_type="image/png",
   629|                ),
   630|            ),
```

### Desired Implementation (target state)

### 1) Remove `output_mime_type` from `ImageConfig`

Remove the unsupported parameter. The API will default to its supported image format.

### 2) Ensure `image_size` is correctly placed

According to `ai.google.dev`, `image_size` should be in `generation_config`. However, the `python-genai` SDK documentation shows it in `ImageConfig`. I will keep it in `ImageConfig` for now as the error was specifically about `output_mime_type`, but I will be ready to move it to `generation_config` if a subsequent error occurs.

Actually, looking at the `python-genai` SDK documentation again, `ImageConfig` is designed for image parameters.

### Execution Phases (required)

#### Implementation (code written)

1. Edit `cdk/lib/lambdas/image_gen_process/handler.py` to remove `output_mime_type="image/png"` from the `ImageConfig` call.

#### Testing / Verification

1. Static checks:
   - `python -m py_compile cdk/lib/lambdas/image_gen_process/handler.py`
2. Docker build sanity:
   - `docker build -t deepcopy-image-gen-process cdk/lib/lambdas/image_gen_process`

### Task

- Implementation (code written)
  1. Remove `output_mime_type="image/png"` from `handler.py`.

- Testing / Verification
  2. Run `py_compile` on `handler.py`.
  3. Run a Docker build for the lambda image.

### Constraints

- Minimum change required to fix the reported error.

### Acceptance Criteria

- `nano_banana` image generation requests no longer include the `output_mime_type` parameter.
- The Lambda code is syntactically valid.
- The Docker image builds successfully.

### Files to Edit (Expected)

- `cdk/lib/lambdas/image_gen_process/handler.py`

