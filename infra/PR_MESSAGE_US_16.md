# Feature: Update OpenAPI Schema for Offer Brief (US-16)

## Description
This PR synchronizes the `cdk/openapi.yaml` specification with the recently updated Pydantic data models used for generating the **Offer Brief**. The API schema now fully reflects the comprehensive 9-section structure introduced in the backend, ensuring accurate data exchange and client generation.

## Related User Stories
- **US-16**: Update OpenAPI Schema for Offer Brief (COMPLETED)
- Related: **US-15**: Offer Brief Generation

## Key Changes

### OpenAPI Specification (`cdk/openapi.yaml`)
- **Updated `OfferBrief` Schema**: Completely restructured to match the new nested design.
- **New Component Schemas**: Added comprehensive definitions for:
    - `MarketSnapshot` (incl. `MarketTemperature` enum)
    - `BigIdeaSection`
    - `ProductInfo` (expanded fields)
    - `PainDesireSection` (incl. `PainCluster`, `DesireCluster`)
    - `FailedSolutionsSection` (incl. `FailedSolutionItem`)
    - `CompetitorLandscape` (incl. `CompetitorEntry`)
    - `BeliefArchitecture` (incl. `BeliefStep`)
    - `ObjectionsSection` (incl. `ObjectionSeverity` enum)
    - `ResearchInspiration`
- **Enums**: Added strict enum validation for market temperature and objection severity.

### Documentation
- Marked `US_16` as completed and moved files to `user_stories/completed/`.

## Verification
- Validated `openapi.yaml` syntax and reference integrity.
- Confirmed that new schema components correspond 1:1 with `cdk/lib/lambdas/process_job_v2/data_models.py`.
- Ran `test_models.py` to ensure Pydantic models are valid and importable.
