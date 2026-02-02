# Story US_03_OPENAPI_UPDATE - Update OpenAPI Spec for General Research Flow

**Status:** 🟢 READY

**Role:** Backend Engineer

## Context
The `jobs` endpoint workflow has been refactored to use a general research approach (Deep Research) to identify avatars, instead of accepting them as input. The output structure has also changed to return multiple avatars and identified avatar lists. The `openapi.yaml` file needs to be updated to match the new implementation.

## Goal
Update `cdk/openapi.yaml` to reflect the API changes:
1.  Update `SubmitJobRequest` to remove/deprecate `customer_avatars` and add `research_requirements`, `gender`, `location`.
2.  Update `JobResult` schema to include `identified_avatars`, `necessary_beliefs` and update `avatar_sheet` structure.
3.  Add necessary new schemas (`IdentifiedAvatar`, `AvatarList`, etc.).

## Dependency
- US_02_GENERAL_RESEARCH_JOBS (Completed)

## Current Implementation (must change)
### `cdk/openapi.yaml`
-   `SubmitJobRequest`: Requires `customer_avatars`.
-   `JobResult`: `avatar_sheet` refers to a single `Avatar`. Missing `identified_avatars`, `necessary_beliefs`.

## Desired Implementation (target state)
### `cdk/openapi.yaml`
-   **`SubmitJobRequest`**:
    -   Remove `customer_avatars` (or mark deprecated/optional and clarify it's ignored).
    -   Add `research_requirements` (string, optional).
    -   Add `gender` (string, optional).
    -   Add `location` (string, optional).
-   **`JobResult`**:
    -   `results.avatar_sheet`: Update to refer to `AvatarList` (object with `avatars` array).
    -   `results.identified_avatars`: Add reference to `IdentifiedAvatarList`.
    -   `results.necessary_beliefs`: Add string field.
    -   `results.customer_avatars`: Update to be a list of `IdentifiedAvatar` (or similar simple structure).
-   **New Schemas**:
    -   `IdentifiedAvatar`: `{name: string, description: string}`.
    -   `IdentifiedAvatarList`: `{avatars: [IdentifiedAvatar]}`.
    -   `AvatarList`: `{avatars: [Avatar]}`.

## Execution Phases (required)

### Implementation (code written)
1.  Edit `cdk/openapi.yaml` to add new schemas.
2.  Edit `cdk/openapi.yaml` to update `SubmitJobRequest`.
3.  Edit `cdk/openapi.yaml` to update `JobResult`.

### Testing / Verification
1.  Manual inspection of the YAML structure.
2.  (Optional) Use an OpenAPI validator if available (skipping for now as per toolset).

## Task
1.  [ ] Add `IdentifiedAvatar` and lists schemas to `cdk/openapi.yaml`.
2.  [ ] Update `SubmitJobRequest` in `cdk/openapi.yaml`.
3.  [ ] Update `JobResult` in `cdk/openapi.yaml`.

## Constraints
-   Ensure existing clients (if any) are considered, though this seems to be a breaking change for the backend inputs anyway.

## Files to Edit (Expected)
-   `cdk/openapi.yaml`

