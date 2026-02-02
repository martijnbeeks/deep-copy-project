# Story 19 — Refactor image_gen_process and write_swipe Lambda code into modular file structures

**Status:** 🔵 COMPLETED

**Role:** Backend Developer

---

## Context

The `image_gen_process` and `write_swipe` Lambda functions currently contain all logic in monolithic handler files (~1281 and ~1082 lines respectively). Following the successful restructuring of `process_job_v2` Lambda (US_17 and US_18), these two lambdas need the same treatment:

### Current State:
1. **`image_gen_process/handler.py`** (~1281 lines):
   - 6+ inline LLM prompts embedded in function bodies
   - Utility functions mixed with business logic
   - Multiple service integrations (OpenAI, Gemini, Cloudflare, S3, DynamoDB)
   - No separation between orchestration and step logic

2. **`write_swipe/handler.py`** (~275 lines) + **`swipe_file_writer.py`** (~807 lines):
   - 2+ large inline prompts (~200 lines each) in `swipe_file_writer.py`
   - Helper functions, retry logic, and API calls all in one file
   - Anthropic service integration mixed with business logic
   - No clear pipeline structure

This structure makes the code difficult to navigate, maintain, and test. Centralizing prompts and restructuring into modular files will improve maintainability and align with the rest of the codebase.

---

## Goal

Refactor both Lambda functions into clean, modular file structures following the patterns established in `process_job_v2`. Extract all inline prompts to dedicated `prompts.py` files, separate utilities, services, and core orchestration logic. Both Lambdas must remain fully functional with identical behavior.

---

## Dependency

- None (US_17 and US_18 provide the template/pattern to follow)

---

## Current Implementation (must change)

### 1) File: `cdk/lib/lambdas/image_gen_process/handler.py`

**Structure Analysis:**
- **Lines 1-58**: Imports, constants (`REF_IMAGES_WITHOUT_PRODUCT`)
- **Lines 59-90**: Logging configuration
- **Lines 92-100**: Environment helpers (`_env()`, `_now_iso()`)
- **Lines 103-131**: AWS service functions (`update_job_status()`, `get_secrets()`, `_configure_from_secrets()`)
- **Lines 150-177**: Image ID utilities (`_slug()`, `_guess_mime_from_key()`, `_normalize_image_id()`)
- **Lines 180-222**: Product image support check (`_supports_product_image()`)
- **Lines 225-314**: Product detection with vision (`ProductDetectionResponse`, `_detect_product_in_image()`) — **Contains prompt lines 245-252**
- **Lines 317-370**: S3/URL download utilities (`_download_image_to_b64()`, `_load_json_from_s3()`, `_load_bytes_from_s3()`, `_extract_openai_image_b64()`)
- **Lines 373-458**: Cloudflare upload (`_upload_base64_to_cloudflare_images()`)
- **Lines 461-504**: Document summarization (`_summarize_docs_if_needed()`) — **Contains prompt lines 468-471**
- **Lines 507-662**: Angle-to-image matching (`_match_angles_to_images()`) — **Contains prompts lines 594-607**
- **Lines 665-729**: OpenAI image generation (`_generate_image_openai()`)
- **Lines 732-841**: Gemini image generation (`_generate_image_nano_banana()`)
- **Lines 844-1237**: `lambda_handler()` — main orchestration — **Contains prompts lines 1044-1121**
- **Lines 1244-1281**: `__main__` block for local testing

**Inline Prompts to Extract:**
| Location | Function | Prompt Purpose |
|----------|----------|----------------|
| Lines 245-252 | `_detect_product_in_image` | Analyze image for product presence |
| Lines 468-471 | `_summarize_docs_if_needed` | Summarize foundational docs |
| Lines 594-600 | `_match_angles_to_images` | System prompt for angle matching |
| Lines 602-607 | `_match_angles_to_images` | User prompt for angle matching |
| Lines 1044-1056 | `lambda_handler` | Image gen base prompt parts |
| Lines 1093-1103 | `lambda_handler` | Product image supported prompt |
| Lines 1106-1121 | `lambda_handler` | Product image not supported prompt |

### 2) File: `cdk/lib/lambdas/write_swipe/handler.py`

**Structure Analysis:**
- **Lines 1-36**: Imports, logging configuration, AWS client initialization
- **Lines 38-50**: `get_secrets()` — AWS service
- **Lines 53-73**: `update_job_status()` — AWS service
- **Lines 76-92**: `save_results_to_s3()` — AWS service
- **Lines 94-102**: `fetch_results_from_s3()` — AWS service
- **Lines 105-108**: `select_swipe_files_template()` — TODO stub
- **Lines 111-133**: `load_swipe_file_templates()` — S3 template loading
- **Lines 136-261**: `lambda_handler()` — main orchestration
- **Lines 264-275**: `__main__` block for local testing

### 3) File: `cdk/lib/lambdas/write_swipe/swipe_file_writer.py`

**Structure Analysis:**
- **Lines 1-46**: Imports, logging configuration
- **Lines 48-115**: `extract_clean_text_from_html()` — utility
- **Lines 117-123**: `load_pdf_file()` — utility
- **Lines 126-242**: `retry_with_exponential_backoff()` — utility
- **Lines 245-287**: Usage stats logging functions — utility
- **Lines 290-301**: `prepare_schema_for_tool_use()` — utility
- **Lines 304-414**: `make_structured_request_with_retry()` — Anthropic service wrapper
- **Lines 417-485**: `make_streaming_request_with_retry()` — Anthropic service wrapper
- **Lines 489-807**: `rewrite_swipe_file()` — main business logic — **Contains prompts lines 529-611 and 632-767**

**Inline Prompts to Extract:**
| Location | Function | Prompt Purpose |
|----------|----------|----------------|
| Lines 529-611 | `rewrite_swipe_file` | Style guide analysis prompt (first_query_prompt) |
| Lines 632-767 | `rewrite_swipe_file` | Advertorial rewrite prompt (third_query_prompt) |

---

## Desired Implementation (target state)

### Target Directory Structure for `image_gen_process`:

```
cdk/lib/lambdas/image_gen_process/
├── handler.py                 # Lambda entry point only (lambda_handler)
├── llm_usage.py               # (unchanged) LLM usage tracking
├── prompts.py                 # All LLM prompts as named functions
├── utils/
│   ├── __init__.py
│   ├── logging_config.py      # Logging configuration setup
│   ├── image.py               # Image ID utilities (_normalize_image_id, _guess_mime_from_key, etc.)
│   └── helpers.py             # Environment helpers (_env, _now_iso, _slug)
├── services/
│   ├── __init__.py
│   ├── aws.py                 # AWS service wrappers (secrets, S3, DynamoDB, update_job_status)
│   ├── openai_service.py      # OpenAI API wrapper (image generation, vision detection)
│   ├── gemini_service.py      # Gemini API wrapper (image generation)
│   └── cloudflare_service.py  # Cloudflare Images upload wrapper
├── pipeline/
│   ├── __init__.py
│   ├── orchestrator.py        # Main orchestration logic (from lambda_handler)
│   └── steps/
│       ├── __init__.py
│       ├── product_detection.py    # _detect_product_in_image, _supports_product_image
│       ├── document_analysis.py    # _summarize_docs_if_needed
│       ├── image_matching.py       # _match_angles_to_images
│       └── image_generation.py     # _generate_image_openai, _generate_image_nano_banana
├── Dockerfile
├── pyproject.toml
└── uv.lock
```

### Target Directory Structure for `write_swipe`:

```
cdk/lib/lambdas/write_swipe/
├── handler.py                 # Lambda entry point only (lambda_handler)
├── llm_usage.py               # (unchanged) LLM usage tracking
├── prompts.py                 # All LLM prompts as named functions
├── utils/
│   ├── __init__.py
│   ├── logging_config.py      # Logging configuration setup
│   ├── html.py                # extract_clean_text_from_html
│   ├── pdf.py                 # load_pdf_file
│   └── retry.py               # retry_with_exponential_backoff
├── services/
│   ├── __init__.py
│   ├── aws.py                 # AWS service wrappers (secrets, S3, DynamoDB)
│   └── anthropic_service.py   # Anthropic API wrapper (streaming, structured output)
├── pipeline/
│   ├── __init__.py
│   ├── orchestrator.py        # Main orchestration logic
│   └── steps/
│       ├── __init__.py
│       ├── template_selection.py   # select_swipe_files_template, load_swipe_file_templates
│       └── swipe_generation.py     # rewrite_swipe_file core logic
├── Dockerfile
├── pyproject.toml
└── uv.lock
```

### Ownership and Responsibility:

| Module | Responsibility |
|--------|---------------|
| `handler.py` | Lambda entry points, event parsing, response formatting |
| `prompts.py` | All LLM prompts as named functions with docstrings |
| `utils/*` | Pure utility functions with no business logic |
| `services/*` | External API wrappers with usage tracking |
| `pipeline/steps/*` | Individual pipeline step implementations |
| `pipeline/orchestrator.py` | Pipeline flow control and coordination |

### Naming Conventions:
- Files: `snake_case.py`
- Classes: `PascalCase`
- Functions/methods: `snake_case`
- Prompt functions: `get_{purpose}_prompt(...)` returning formatted strings

---

## Execution Phases

### Phase 1: Implementation — image_gen_process (code written)

#### Task 1: Create directory structure for image_gen_process
- [ ] Create `utils/` directory with `__init__.py`
- [ ] Create `services/` directory with `__init__.py`
- [ ] Create `pipeline/` directory with `__init__.py`
- [ ] Create `pipeline/steps/` directory with `__init__.py`

#### Task 2: Create prompts.py for image_gen_process
**File:** `cdk/lib/lambdas/image_gen_process/prompts.py`
- [ ] Extract `get_detect_product_prompt()` from lines 245-252
- [ ] Extract `get_summarize_docs_prompt(language, text)` from lines 468-471
- [ ] Extract `get_match_angles_system_prompt()` from lines 594-600
- [ ] Extract `get_match_angles_user_prompt(selected_avatar, used_ids, slots_desc, images)` from lines 602-607
- [ ] Extract `get_image_gen_base_prompt(language, avatar, angle, product_name)` from lines 1044-1056
- [ ] Extract `get_image_gen_with_product_prompt()` from lines 1093-1103
- [ ] Extract `get_image_gen_without_product_prompt(supports_product)` from lines 1106-1121

#### Task 3: Extract utility modules for image_gen_process
- [ ] Create `utils/logging_config.py` — extract logging setup (lines 68-90)
- [ ] Create `utils/helpers.py` — extract `_env()`, `_now_iso()`, `_slug()` (lines 92-100, 150-153)
- [ ] Create `utils/image.py` — extract `_guess_mime_from_key()`, `_normalize_image_id()`, `_supports_product_image()` (lines 156-222)

#### Task 4: Extract service modules for image_gen_process
- [ ] Create `services/aws.py` — extract `get_secrets()`, `_configure_from_secrets()`, `update_job_status()`, S3 helpers (lines 103-131, 134-147, 332-340)
- [ ] Create `services/openai_service.py` — extract `_detect_product_in_image()`, `_generate_image_openai()`, `_extract_openai_image_b64()` (lines 230-314, 343-370, 665-729)
- [ ] Create `services/gemini_service.py` — extract `_generate_image_nano_banana()` (lines 732-841)
- [ ] Create `services/cloudflare_service.py` — extract `_upload_base64_to_cloudflare_images()` (lines 373-458)

#### Task 5: Extract pipeline step modules for image_gen_process
- [ ] Create `pipeline/steps/product_detection.py` — extract product detection logic
- [ ] Create `pipeline/steps/document_analysis.py` — extract `_summarize_docs_if_needed()` (lines 461-504)
- [ ] Create `pipeline/steps/image_matching.py` — extract `_match_angles_to_images()` (lines 507-662)
- [ ] Create `pipeline/steps/image_generation.py` — consolidate generation functions

#### Task 6: Create orchestrator for image_gen_process
- [ ] Create `pipeline/orchestrator.py` — extract main orchestration logic from `lambda_handler` (lines 844-1237)

#### Task 7: Refactor handler.py for image_gen_process
- [ ] Reduce to Lambda entry point only (~50-100 lines)
- [ ] Update imports to reference new modules

#### Task 8: Update Dockerfile for image_gen_process
- [ ] Ensure all new directories are copied correctly (utils/, services/, pipeline/, prompts.py)

### Phase 2: Implementation — write_swipe (code written)

#### Task 9: Create directory structure for write_swipe
- [ ] Create `utils/` directory with `__init__.py`
- [ ] Create `services/` directory with `__init__.py`
- [ ] Create `pipeline/` directory with `__init__.py`
- [ ] Create `pipeline/steps/` directory with `__init__.py`

#### Task 10: Create prompts.py for write_swipe
**File:** `cdk/lib/lambdas/write_swipe/prompts.py`
- [ ] Extract `get_style_guide_analysis_prompt(raw_swipe_file_text)` from lines 529-611
- [ ] Extract `get_advertorial_rewrite_prompt(style_guide, angle, deep_research, offer_brief, marketing_philosophy)` from lines 632-767

#### Task 11: Extract utility modules for write_swipe
- [ ] Create `utils/logging_config.py` — extract logging setup (lines 22-38 from swipe_file_writer.py)
- [ ] Create `utils/html.py` — extract `extract_clean_text_from_html()` (lines 48-115)
- [ ] Create `utils/pdf.py` — extract `load_pdf_file()` (lines 117-123)
- [ ] Create `utils/retry.py` — extract `retry_with_exponential_backoff()` (lines 126-242)

#### Task 12: Extract service modules for write_swipe
- [ ] Create `services/aws.py` — extract `get_secrets()`, `update_job_status()`, `save_results_to_s3()`, `fetch_results_from_s3()` (from handler.py lines 38-102)
- [ ] Create `services/anthropic_service.py` — extract `make_structured_request_with_retry()`, `make_streaming_request_with_retry()`, `prepare_schema_for_tool_use()`, usage stats functions (lines 245-485)

#### Task 13: Extract pipeline step modules for write_swipe
- [ ] Create `pipeline/steps/template_selection.py` — extract `select_swipe_files_template()`, `load_swipe_file_templates()` (handler.py lines 105-133)
- [ ] Create `pipeline/steps/swipe_generation.py` — extract core logic from `rewrite_swipe_file()` (lines 489-807)

#### Task 14: Create orchestrator for write_swipe
- [ ] Create `pipeline/orchestrator.py` — extract orchestration logic from handler

#### Task 15: Refactor handler.py for write_swipe
- [ ] Reduce to Lambda entry point only (~50-100 lines)
- [ ] Update imports to reference new modules
- [ ] Remove `swipe_file_writer.py` (functionality moved to pipeline/steps/)

#### Task 16: Update Dockerfile for write_swipe
- [ ] Ensure all new directories are copied correctly

### Phase 3: Testing / Verification

#### Task 17: Syntax and Import Verification — image_gen_process
- [ ] Run `cd cdk/lib/lambdas/image_gen_process && python -m py_compile handler.py prompts.py`
- [ ] Run `cd cdk/lib/lambdas/image_gen_process && python -c "from handler import lambda_handler"`
**Expected:** No syntax or import errors

#### Task 18: Syntax and Import Verification — write_swipe
- [ ] Run `cd cdk/lib/lambdas/write_swipe && python -m py_compile handler.py prompts.py`
- [ ] Run `cd cdk/lib/lambdas/write_swipe && python -c "from handler import lambda_handler"`
**Expected:** No syntax or import errors

#### Task 19: CDK Synth Validation
- [ ] Run `cd cdk && npx cdk synth --quiet`
**Expected:** Successful synthesis

#### Task 20: Local Execution Test
- [ ] Test image_gen_process Lambda locally with `python handler.py`
- [ ] Test write_swipe Lambda locally with `python handler.py`
**Expected:** Both execute without errors (may need mock data)

---

## Constraints

- **No behavioral changes**: Both Lambdas must produce identical outputs for identical inputs.
- **No new dependencies**: Only restructure existing code.
- **Imports must work in Lambda environment**: Use relative imports within Lambda packages.
- **Dockerfile compatibility**: Ensure Docker build still works.
- **Follow process_job_v2 patterns**: Use same naming conventions and structure.

---

## Acceptance Criteria

1. [ ] All Python files pass `python -m py_compile` syntax check
2. [ ] `from handler import lambda_handler` succeeds for both Lambdas
3. [ ] `image_gen_process/handler.py` contains only entry points (<150 lines)
4. [ ] `write_swipe/handler.py` contains only entry points (<100 lines)
5. [ ] `image_gen_process/prompts.py` contains all 7 prompt functions
6. [ ] `write_swipe/prompts.py` contains all 2 prompt functions
7. [ ] No inline LLM prompts remain in handler or step modules
8. [ ] CDK synthesis succeeds
9. [ ] Dockerfiles updated to include new directories
10. [ ] Local test execution passes for both Lambdas

---

## Files to Edit (Expected)

### image_gen_process — New Files to Create:
- `cdk/lib/lambdas/image_gen_process/prompts.py`
- `cdk/lib/lambdas/image_gen_process/utils/__init__.py`
- `cdk/lib/lambdas/image_gen_process/utils/logging_config.py`
- `cdk/lib/lambdas/image_gen_process/utils/helpers.py`
- `cdk/lib/lambdas/image_gen_process/utils/image.py`
- `cdk/lib/lambdas/image_gen_process/services/__init__.py`
- `cdk/lib/lambdas/image_gen_process/services/aws.py`
- `cdk/lib/lambdas/image_gen_process/services/openai_service.py`
- `cdk/lib/lambdas/image_gen_process/services/gemini_service.py`
- `cdk/lib/lambdas/image_gen_process/services/cloudflare_service.py`
- `cdk/lib/lambdas/image_gen_process/pipeline/__init__.py`
- `cdk/lib/lambdas/image_gen_process/pipeline/orchestrator.py`
- `cdk/lib/lambdas/image_gen_process/pipeline/steps/__init__.py`
- `cdk/lib/lambdas/image_gen_process/pipeline/steps/product_detection.py`
- `cdk/lib/lambdas/image_gen_process/pipeline/steps/document_analysis.py`
- `cdk/lib/lambdas/image_gen_process/pipeline/steps/image_matching.py`
- `cdk/lib/lambdas/image_gen_process/pipeline/steps/image_generation.py`

### image_gen_process — Existing Files to Modify:
- `cdk/lib/lambdas/image_gen_process/handler.py` (major refactor)
- `cdk/lib/lambdas/image_gen_process/Dockerfile` (add new directories)

### write_swipe — New Files to Create:
- `cdk/lib/lambdas/write_swipe/prompts.py`
- `cdk/lib/lambdas/write_swipe/utils/__init__.py`
- `cdk/lib/lambdas/write_swipe/utils/logging_config.py`
- `cdk/lib/lambdas/write_swipe/utils/html.py`
- `cdk/lib/lambdas/write_swipe/utils/pdf.py`
- `cdk/lib/lambdas/write_swipe/utils/retry.py`
- `cdk/lib/lambdas/write_swipe/services/__init__.py`
- `cdk/lib/lambdas/write_swipe/services/aws.py`
- `cdk/lib/lambdas/write_swipe/services/anthropic_service.py`
- `cdk/lib/lambdas/write_swipe/pipeline/__init__.py`
- `cdk/lib/lambdas/write_swipe/pipeline/orchestrator.py`
- `cdk/lib/lambdas/write_swipe/pipeline/steps/__init__.py`
- `cdk/lib/lambdas/write_swipe/pipeline/steps/template_selection.py`
- `cdk/lib/lambdas/write_swipe/pipeline/steps/swipe_generation.py`

### write_swipe — Existing Files to Modify:
- `cdk/lib/lambdas/write_swipe/handler.py` (major refactor)
- `cdk/lib/lambdas/write_swipe/Dockerfile` (add new directories)

### write_swipe — Files to Delete:
- `cdk/lib/lambdas/write_swipe/swipe_file_writer.py` (functionality moved to new modules)

---

## Files to Keep Unchanged
- `cdk/lib/lambdas/image_gen_process/llm_usage.py`
- `cdk/lib/lambdas/image_gen_process/pyproject.toml`
- `cdk/lib/lambdas/image_gen_process/uv.lock`
- `cdk/lib/lambdas/write_swipe/llm_usage.py`
- `cdk/lib/lambdas/write_swipe/pyproject.toml`
- `cdk/lib/lambdas/write_swipe/uv.lock`

---

## Out of Scope
- Modifying prompt content or wording
- Adding prompt versioning or A/B testing infrastructure
- Loading prompts from external sources (S3, DynamoDB)
- Changes to data models or LLM invocation logic
- Unit test creation (separate US if needed)
- Performance optimization
