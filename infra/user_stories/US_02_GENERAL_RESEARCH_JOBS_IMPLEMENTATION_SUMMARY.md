# Implementation Summary - US_02_GENERAL_RESEARCH_JOBS

## What Changed
### `cdk/lib/lambdas/process_job/data_models.py`
-   Added `IdentifiedAvatar` and `IdentifiedAvatarList` models to support the new 2-step avatar generation process.
-   Added `AvatarList` model to contain multiple full `Avatar` objects.

### `cdk/lib/lambdas/process_job/handler.py`
-   Refactored `analyze_research_page` to remove dependency on pre-existing `customer_avatars` input. It now performs a general analysis.
-   Updated `create_deep_research_prompt` to accept `gender`, `location`, and `research_requirements` as optional inputs, and ask for research covering multiple avatars.
-   Implemented `identify_avatars` method which uses GPT-5 to extract a list of potential avatars (`IdentifiedAvatarList`) from the deep research output.
-   Implemented `complete_avatar_details` method to generate a full `Avatar` sheet for a specific identified avatar.
-   Implemented `complete_necessary_beliefs` method using the custom prompt structure to extract necessary belief shifts.
-   Updated `run_pipeline`:
    -   Added support for `gender`, `location`, `research_requirements` inputs.
    -   Replaced the single-step avatar completion with a loop: first identify avatars, then generate details for each.
    -   Aggregated marketing angles from all generated avatars.
    -   Added the `complete_necessary_beliefs` step to the pipeline.
    -   Updated the final results dictionary to include `identified_avatars`, `necessary_beliefs`, and the list-based `avatar_sheet`.

## What Did NOT Change
-   The downstream steps (Offer Brief, Marketing Philosophy, Summary) largely remained the same, except for receiving updated inputs (e.g. `avatar_sheet` string representation).
-   The `DeepCopy` class initialization and other helper methods (`save_results_to_s3`, etc.) were preserved.
-   Swipe file and Image gen lambdas were not touched (compatibility maintained via result structure).

## Deviations from US
-   None. The implementation followed the 2-step avatar generation requirement added during the task.

## New Risks / Tech Debt
-   **Prompt Tuning**: The prompts for `identify_avatars` and `complete_avatar_details` might need refinement to ensure high-quality, distinct avatars.
-   **Latency**: Generating multiple avatars in a loop will increase the total execution time of the lambda. It might hit the 15-minute timeout if too many avatars are identified. We might need to parallelize this loop using `ThreadPoolExecutor` in the future.
-   **Token Usage**: Multiple GPT-5 calls per job will increase costs.



