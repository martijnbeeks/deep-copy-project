# Story US_02_GENERAL_RESEARCH_JOBS - Refactor Jobs Endpoint for General Research & Multi-Avatar Generation

**Status:** 🟠 CODE WRITTEN (NEEDS TESTING)

**Role:** Backend Engineer

## Context
The current workflow requires an upstream `avatar_extraction` step to provide `customer_avatars` to the `jobs` endpoint. The user wants to decouple this, allowing the `jobs` endpoint to start with just a Product URL (and optional parameters), perform deep research to discover multiple avatars and angles, and then generate the assets.

## Goal
Refactor the `jobs` pipeline to:
1.  Accept `sales_page_url` and optional `research_requirements`, `gender`, `location` as input.
2.  Perform generic research on the sales page (without pre-known avatars).
3.  Use Deep Research to identify *multiple* avatars and marketing angles.
4.  **Two-Step Avatar Generation**:
    -   Step 1: Identify list of potential avatars (name + description).
    -   Step 2: Generate full `Avatar` sheet for each identified avatar.
5.  Extract "necessary beliefs" per avatar using a custom prompt (`necessary_beliefs_prompt.txt`).
6.  Maintain compatibility with downstream steps (Swipe Files, Ad Gen) by aggregating angles.

## Dependency
None.

## Current Implementation (must change)
### 1) `cdk/lib/lambdas/process_job/data_models.py`
-   `Avatar` model represents a single avatar sheet.
-   No container for multiple avatars.

### 2) `cdk/lib/lambdas/process_job/handler.py`
-   `analyze_research_page` requires `customer_avatars` input.
-   `create_deep_research_prompt` is tailored to a specific avatar.
-   `complete_avatar_sheet` returns a single `Avatar` object.
-   `run_pipeline` expects `customer_avatars` in event.
-   No `complete_necessary_beliefs` step.

## Desired Implementation (target state)
### 1) `cdk/lib/lambdas/process_job/data_models.py`
-   Add `IdentifiedAvatar` and `IdentifiedAvatarList` for the identification step.
-   Ensure `AvatarList` is present (already added).
-   Add `NecessaryBeliefs` model (optional, or just use text/JSON).

### 2) `cdk/lib/lambdas/process_job/handler.py`
-   `analyze_research_page(sales_page_url)`: generic analysis of the page (product, claims, proof, etc.).
-   `create_deep_research_prompt(...)`: Ask for research covering multiple potential avatars based on inputs (`gender`, `location`, `requirements`).
-   `identify_avatars(deep_research_output)`: Return `IdentifiedAvatarList`.
-   `complete_avatar_details(identified_avatar, deep_research_output)`: Return full `Avatar`.
-   `complete_necessary_beliefs(deep_research_output, avatar_list)`: New step to extract beliefs using `necessary_beliefs_prompt.txt`.
-   `run_pipeline`:
    -   Accept new inputs.
    -   Skip `customer_avatars` check.
    -   Execute identification step.
    -   Loop through identified avatars to generate full sheets.
    -   Aggregate angles from all generated avatars into `marketing_angles` list for downstream compatibility.

## Execution Phases (required)

### Implementation (code written)
1.  **Update Data Models**: Add `IdentifiedAvatar` and `IdentifiedAvatarList` to `cdk/lib/lambdas/process_job/data_models.py`.
2.  **Refactor Handler**:
    -   Modify `analyze_research_page` to work without `customer_avatars`.
    -   Modify `create_deep_research_prompt` to include `gender`, `location`, `research_requirements` and ask for multiple avatars.
    -   Implement `identify_avatars`.
    -   Implement `complete_avatar_details`.
    -   Implement `complete_necessary_beliefs` using the prompt file content.
    -   Update `run_pipeline` logic to orchestrate the loop.

### Testing / Verification
1.  **Unit/Local Test**:
    -   Run `test_local.sh` (or equivalent python script) with a `sales_page_url` and new optional params.
    -   Verify `comprehensive_results.json` contains `avatar_sheet` as `AvatarList` and `marketing_angles` is populated.
    -   Verify `necessary_beliefs` are present.

## Task
1.  [ ] Update `cdk/lib/lambdas/process_job/data_models.py` with `IdentifiedAvatar` models.
2.  [ ] Update `analyze_research_page` in `process_job/handler.py`.
3.  [ ] Update `create_deep_research_prompt` in `process_job/handler.py`.
4.  [ ] Implement `identify_avatars` in `process_job/handler.py`.
5.  [ ] Implement `complete_avatar_details` in `process_job/handler.py`.
6.  [ ] Implement `complete_necessary_beliefs` in `process_job/handler.py`.
7.  [ ] Update `run_pipeline` in `process_job/handler.py`.

## Constraints
-   Keep the rest of the flow (Swipe files, Ad gen) intact.
-   Ensure `marketing_angles` output format remains compatible.
-   Use `necessary_beliefs_prompt.txt` for the beliefs prompt.

## Files to Edit (Expected)
-   `cdk/lib/lambdas/process_job/data_models.py`
-   `cdk/lib/lambdas/process_job/handler.py`
