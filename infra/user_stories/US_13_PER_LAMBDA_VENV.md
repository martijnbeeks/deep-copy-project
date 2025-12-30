# Story US_13 — Per-lambda virtual environments and debug configurations
**Status:** ✅ COMPLETED
**Role:** Platform Engineer

## Context
Currently, debug configurations in `.vscode/launch.json` use a shared virtual environment from `${workspaceFolder}/ai_pipeline/.venv`. This can lead to dependency conflicts and doesn't accurately reflect the isolated runtime environment of each AWS Lambda function.

## Goal
Create isolated virtual environments for each Lambda function directory and update the debug configurations to use them.

## Dependency
- `uv` or `python -m venv`
- Lambda directories with `pyproject.toml` or `requirements.txt`

## Current Implementation (must change)

### 1) Shared python path in `.vscode/launch.json`
```json
"python": "${workspaceFolder}/ai_pipeline/.venv/bin/python",
```

### 2) Missing isolated venvs in lambda folders
Lambda directories currently do not have their own `.venv` folders.

## Desired Implementation (target state)
- Each lambda directory (`extract_avatars`, `image_gen_process`, `process_job`, `process_job_v2`, `write_swipe`) has its own `.venv`.
- `.gitignore` prevents these `.venv` folders from being committed.
- `.vscode/launch.json` is updated to point the `python` path to the respective `.venv/bin/python` for each configuration.

## Execution Phases

### Implementation (code written)
1. Add `cdk/lib/lambdas/**/.venv/` to `.gitignore`.
2. For each lambda directory:
    - Create a virtual environment.
    - Install dependencies.
3. Update `.vscode/launch.json` configurations.

### Testing / Verification
1. Verify each lambda has a `.venv`.
2. Verify debug configurations in VS Code point to the correct python interpreter.

## Task
1. [ ] Update `.gitignore`.
2. [ ] Create venvs and install dependencies for:
    - `extract_avatars`
    - `image_gen_process`
    - `process_job`
    - `process_job_v2`
    - `write_swipe`
3. [ ] Update `.vscode/launch.json`.

## Constraints
- Use isolated environments.
- Ensure `.gitignore` is updated before creating the folders.

## Files to Edit (Expected)
- `.gitignore`
- `.vscode/launch.json`
- Lambda directories (creation of `.venv`)

