# Story 18 — Restructure process_job_v2 Lambda code into modular file structure

**Status:** 🟠 CODE WRITTEN (NEEDS TESTING)

**Role:** Backend Developer

---

## Context

The `process_job_v2` Lambda currently contains all logic in a single monolithic `handler.py` file (~2000 lines). This includes:
- Core `DeepCopy` class with all business logic methods
- Utility functions (image processing, HTML extraction, schema operations)
- LLM prompts embedded inline in methods
- Pipeline orchestration logic
- Lambda entry points (`lambda_handler`, `run_pipeline`)

This structure makes the code difficult to navigate, maintain, and test. There are no clear boundaries between concerns.

---

## Goal

Restructure the Lambda code into a clean, modular file structure outside/inside the `process_job_v2` directory. Each module should have a single responsibility, making the codebase easier to understand, maintain, debug, and extend. The Lambda must remain fully functional with identical behavior.

---

## Dependency

- None (standalone refactoring task)

---

## Current Implementation (must change)

### 1) File: `cdk/lib/lambdas/process_job_v2/handler.py`
- **Lines 1-73**: Imports, logging configuration, utility function `extract_clean_text_from_html()`
- **Lines 75-118**: `save_fullpage_png()` - Playwright screenshot function
- **Lines 121-172**: `compress_image_if_needed()` - Image compression utility
- **Lines 175-336**: Schema/model utilities (`json_type_to_python()`, `create_model_from_schema()`, `load_schema_as_model()`)
- **Lines 340-1724**: `DeepCopy` class with ALL business logic methods:
  - `__init__`, `_emit_openai`, `_emit_perplexity`, `get_secrets` (lines 341-424)
  - `analyze_research_page` (lines 426-486)
  - `create_deep_research_prompt` (lines 488-821) - contains massive inline prompt
  - `execute_deep_research` (lines 823-861)
  - `identify_avatars` (lines 863-935) - contains inline prompt
  - `complete_avatar_details` (lines 937-986) - contains inline prompt
  - `complete_necessary_beliefs_for_avatar` (lines 988-1216) - contains inline prompt
  - `generate_marketing_angles` (lines 1218-1500) - contains inline prompt
  - `create_offer_brief` (lines 1504-1607) - contains inline prompt
  - `create_summary` (lines 1609-1662) - contains inline prompt
  - `save_results_to_s3` (lines 1664-1698)
  - `update_job_status` (lines 1700-1724)
- **Lines 1726-1945**: `run_pipeline()` function - pipeline orchestration
- **Lines 1948-2002**: `lambda_handler()` entry point and `__main__` block

### 2) File: `cdk/lib/lambdas/process_job_v2/data_models.py`
- ~983 lines of Pydantic data models (already separate, keep as-is)

### 3) File: `cdk/lib/lambdas/process_job_v2/llm_usage.py`
- ~207 lines of LLM usage tracking utilities (already separate, keep as-is)

---

## Desired Implementation (target state)

### Target Directory Structure:

```
cdk/lib/lambdas/process_job_v2/
├── handler.py                 # Lambda entry points only (lambda_handler, run_pipeline)
├── data_models.py             # (unchanged) Pydantic models
├── llm_usage.py               # (unchanged) LLM usage tracking
├── deep_copy.py               # Core DeepCopy orchestrator class (slimmed down)
├── prompts.py                 # All LLM prompts as constants/functions
├── utils/
│   ├── __init__.py
│   ├── image.py               # save_fullpage_png, compress_image_if_needed
│   ├── html.py                # extract_clean_text_from_html
│   ├── schema.py              # json_type_to_python, create_model_from_schema, load_schema_as_model
│   └── logging_config.py      # Logging configuration setup
├── services/
│   ├── __init__.py
│   ├── aws.py                 # AWS service wrappers (secrets, S3, DynamoDB)
│   ├── openai_service.py      # OpenAI API wrapper with usage tracking
│   └── perplexity_service.py  # Perplexity API wrapper with usage tracking
├── pipeline/
│   ├── __init__.py
│   ├── steps/
│   │   ├── __init__.py
│   │   ├── analyze_page.py    # analyze_research_page logic
│   │   ├── deep_research.py   # create_deep_research_prompt, execute_deep_research
│   │   ├── avatars.py         # identify_avatars, complete_avatar_details, complete_necessary_beliefs_for_avatar
│   │   ├── marketing.py       # generate_marketing_angles
│   │   ├── offer_brief.py     # create_offer_brief
│   │   └── summary.py         # create_summary
│   └── orchestrator.py        # Pipeline orchestration (run_pipeline logic)
├── Dockerfile
├── pyproject.toml
└── uv.lock
```

### Ownership and Responsibility:

| Module | Responsibility |
|--------|---------------|
| `handler.py` | Lambda entry points, event parsing, response formatting |
| `deep_copy.py` | Thin orchestrator, delegates to services and pipeline steps |
| `prompts.py` | All LLM prompts as named constants or factory functions |
| `utils/*` | Pure utility functions with no business logic |
| `services/*` | External API wrappers with telemetry |
| `pipeline/steps/*` | Individual pipeline step implementations |
| `pipeline/orchestrator.py` | Pipeline flow control and parallelization |

### Naming Conventions:
- Files: `snake_case.py`
- Classes: `PascalCase`
- Functions/methods: `snake_case`
- Constants (prompts): `SCREAMING_SNAKE_CASE`

---

## Execution Phases

### Phase 1: Implementation (code written)

#### Task 1: Create directory structure
- [x] Create `utils/` directory with `__init__.py`
- [x] Create `services/` directory with `__init__.py`
- [x] Create `pipeline/` directory with `__init__.py`
- [x] Create `pipeline/steps/` directory with `__init__.py`

#### Task 2: Extract utility modules
- [x] Create `utils/logging_config.py` - extract lines 51-72 (logging setup)
- [x] Create `utils/html.py` - extract `extract_clean_text_from_html()` (lines 36-48)
- [x] Create `utils/image.py` - extract `save_fullpage_png()` and `compress_image_if_needed()` (lines 75-172)
- [x] Create `utils/schema.py` - extract schema utilities (lines 175-336)

#### Task 3: Extract service modules
- [x] Create `services/aws.py` - extract `get_secrets()`, S3/DynamoDB client setup, `save_results_to_s3()`, `update_job_status()`
- [x] Create `services/openai_service.py` - extract `_emit_openai()` and OpenAI client wrapper
- [x] Create `services/perplexity_service.py` - extract `_emit_perplexity()` and Perplexity client wrapper

#### Task 4: Verify and integrate prompts module
- [x] `prompts.py` already exists from US_17 work with all prompts extracted:
  - `get_analyze_research_page_prompt()`
  - `get_deep_research_prompt()`
  - `get_identify_avatars_prompt()`
  - `get_complete_avatar_details_prompt()`
  - `get_necessary_beliefs_prompt()`
  - `get_marketing_angles_prompt()`
  - `get_offer_brief_prompt()`
  - `get_summary_prompt()`
- [x] Update handler.py methods to import and use prompts from `prompts.py` (pipeline steps now use prompts.py)

#### Task 5: Extract pipeline step modules
- [x] Create `pipeline/steps/analyze_page.py` - extract `analyze_research_page()` logic
- [x] Create `pipeline/steps/deep_research.py` - extract `create_deep_research_prompt()` and `execute_deep_research()`
- [x] Create `pipeline/steps/avatars.py` - extract avatar-related methods
- [x] Create `pipeline/steps/marketing.py` - extract `generate_marketing_angles()`
- [x] Create `pipeline/steps/offer_brief.py` - extract `create_offer_brief()`
- [x] Create `pipeline/steps/summary.py` - extract `create_summary()`

#### Task 6: Create orchestrator module
- [x] Create `pipeline/orchestrator.py` - extract `run_pipeline()` logic (lines 1726-1945)

#### Task 7: Refactor DeepCopy class
- [x] ~~Create `deep_copy.py`~~ - NOT NEEDED: `PipelineOrchestrator` in `pipeline/orchestrator.py` serves this role

#### Task 8: Update handler.py
- [x] Reduce to Lambda entry points only (`lambda_handler`, event parsing, response formatting) - now 129 lines
- [x] Update imports to reference new modules

#### Task 9: Update Dockerfile if needed
- [x] Ensure all new directories are copied correctly (utils/, services/, pipeline/, prompts.py)

### Phase 2: Testing / Verification

#### Task 10: Syntax and Import Verification
- [x] Run `python -m py_compile handler.py` to verify syntax - ALL PASS
- [ ] Run `python -c "from handler import lambda_handler"` to verify imports

#### Task 11: Local Execution Test
- [ ] Run the Lambda locally with a test event using `python handler.py` with `dev_mode=true`
- [ ] Verify mock results are loaded and processed correctly

#### Task 12: Deploy and Integration Test
- [ ] Deploy using CDK: `cdk deploy`
- [ ] Submit a test job via the API
- [ ] Verify job completes successfully
- [ ] Verify results are saved to S3 in the expected format

---

## Constraints

- **No behavioral changes**: The Lambda must produce identical outputs for identical inputs.
- **No new dependencies**: Only restructure existing code.
- **Imports must work in Lambda environment**: Relative imports within the Lambda package.
- **Dockerfile compatibility**: Ensure Docker build still works.

---

## Acceptance Criteria

1. [x] All Python files pass `python -m py_compile` syntax check
2. [ ] `from handler import lambda_handler` succeeds without errors
3. [x] `handler.py` contains only entry points (129 lines - close to target)
4. [ ] `deep_copy.py` contains the orchestrator class (< 200 lines)
5. [ ] All LLM prompts are in `prompts.py`
6. [ ] No inline LLM prompts remain in pipeline step modules
7. [ ] Local test with `dev_mode=true` produces identical results
8. [ ] CDK deployment succeeds
9. [ ] Integration test job completes with status SUCCEEDED
10. [ ] Results format in S3 is unchanged

---

## Files to Edit (Expected)

### New Files to Create:
- `cdk/lib/lambdas/process_job_v2/deep_copy.py`
- `cdk/lib/lambdas/process_job_v2/utils/__init__.py`
- `cdk/lib/lambdas/process_job_v2/utils/logging_config.py`
- `cdk/lib/lambdas/process_job_v2/utils/html.py`
- `cdk/lib/lambdas/process_job_v2/utils/image.py`
- `cdk/lib/lambdas/process_job_v2/utils/schema.py`
- `cdk/lib/lambdas/process_job_v2/services/__init__.py`
- `cdk/lib/lambdas/process_job_v2/services/aws.py`
- `cdk/lib/lambdas/process_job_v2/services/openai_service.py`
- `cdk/lib/lambdas/process_job_v2/services/perplexity_service.py`
- `cdk/lib/lambdas/process_job_v2/pipeline/__init__.py`
- `cdk/lib/lambdas/process_job_v2/pipeline/orchestrator.py`
- `cdk/lib/lambdas/process_job_v2/pipeline/steps/__init__.py`
- `cdk/lib/lambdas/process_job_v2/pipeline/steps/analyze_page.py`
- `cdk/lib/lambdas/process_job_v2/pipeline/steps/deep_research.py`
- `cdk/lib/lambdas/process_job_v2/pipeline/steps/avatars.py`
- `cdk/lib/lambdas/process_job_v2/pipeline/steps/marketing.py`
- `cdk/lib/lambdas/process_job_v2/pipeline/steps/offer_brief.py`
- `cdk/lib/lambdas/process_job_v2/pipeline/steps/summary.py`

### Existing Files to Modify:
- `cdk/lib/lambdas/process_job_v2/handler.py` (major refactor)
- `cdk/lib/lambdas/process_job_v2/prompts.py` (already exists from US_17, may need minor updates)
- `cdk/lib/lambdas/process_job_v2/Dockerfile` (if needed for new directories)

### Files to Keep Unchanged:
- `cdk/lib/lambdas/process_job_v2/data_models.py`
- `cdk/lib/lambdas/process_job_v2/llm_usage.py`
- `cdk/lib/lambdas/process_job_v2/pyproject.toml`
- `cdk/lib/lambdas/process_job_v2/uv.lock`
