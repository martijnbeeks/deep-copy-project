# Story US_13 — Per-lambda virtual environments and debug configurations IMPLEMENTATION SUMMARY

## What changed
- **Isolated Venvs**: Created a dedicated `.venv` for each of the five core Lambda functions:
    - `cdk/lib/lambdas/process_job/`
    - `cdk/lib/lambdas/process_job_v2/`
    - `cdk/lib/lambdas/image_gen_process/`
    - `cdk/lib/lambdas/extract_avatars/`
    - `cdk/lib/lambdas/write_swipe/`
- **Dependency Management**: Installed all required dependencies in each venv using `uv` (syncing from `pyproject.toml` or installing from `requirements.txt`).
- **VS Code Configuration**: Updated `.vscode/launch.json` to point each debug configuration to its respective Lambda's virtual environment.
- **Git Hygiene**: Updated `.gitignore` to exclude all `.venv/` folders in the Lambda subdirectories.

## What did NOT change
- The Lambda handler logic remains untouched.
- The shared `${workspaceFolder}/ai_pipeline/.venv` remains for top-level script execution if needed, though most tasks now have isolated environments.

## Deviations from US
- Updated `cwd` for "Debug avatar" in `launch.json` to point to its lambda directory for consistency with other configurations.

## New risks / tech debt
- Developers now need to manage multiple virtual environments if they want to run or test different lambdas locally.
- Any new dependencies added to a lambda must be installed in its specific `.venv`.

