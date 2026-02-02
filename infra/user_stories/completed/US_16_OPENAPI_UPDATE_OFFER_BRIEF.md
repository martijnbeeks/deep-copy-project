# US_16: Update OpenAPI Schema for Offer Brief

**Status:** ✅ COMPLETED
**Created:** 2026-01-09
**Complexity:** S

---

## Problem Statement
The `OfferBrief` and related Pydantic models in `cdk/lib/lambdas/process_job_v2/data_models.py` have been significantly updated by the user to include comprehensive details (Section 1-9) such as `MarketSnapshot`, `BigIdeaSection`, `PainDesireSection`, etc. The current `cdk/openapi.yaml` does not reflect these changes and still uses the older, simpler schema.

## Success Criteria
- [x] `cdk/openapi.yaml` is updated to include all new schemas defined in `data_models.py`.
- [x] `MarketTemperature` enum is added.
- [x] `OfferBrief` schema in `cdk/openapi.yaml` matches the fields and nested structures in the Python code.
- [x] All new helper schemas (`PainCluster`, `DesireCluster`, `ObjectionItem`, etc.) are defined in the `components/schemas` section.

---

## Data Model Changes (Summary)
Reflecting changes in `data_models.py`:
1.  **Enums:** `MarketTemperature`, `ObjectionSeverity`.
2.  **New Schemas:** 
    - `MarketSnapshot`
    - `BigIdeaSection` (replacing flat fields in OfferBrief)
    - `ProductInfo` (updated with `format`, `price`, `guarantee`, etc.)
    - `PainCluster`, `DesireCluster`, `PainDesireSection`
    - `FailedSolutionItem`, `FailedSolutionsSection`
    - `CompetitorEntry`, `CompetitorLandscape`
    - `BeliefStep`, `BeliefArchitecture`
    - `ObjectionItem`, `ObjectionsSection`
    - `RawQuoteWithSource`, `RawQuotesSection`, `ResearchInspiration`
3.  **OfferBrief:** Updated to use these new nested schemas instead of flat lists for `big_idea`, `metaphors`, etc., and added new sections.

## Implementation Plan

### Pre-Implementation Checklist
- [x] Create branch `feature/US_16_openapi_update`.

### Tasks

#### Task 1: Add New Helper Schemas
**File:** `cdk/openapi.yaml`
**Description:** Add definitions for all the new Pydantic models (Enums and nested helper classes) to `components/schemas`.

#### Task 2: Update `OfferBrief` Schema
**File:** `cdk/openapi.yaml`
**Description:** completely replace the properties of `OfferBrief` to match the new structure (Sections 1 through 9 + legacy fields if any remain).

**Target Schema Structure for OfferBrief:**
```yaml
OfferBrief:
  type: object
  properties:
    market_snapshot:
      $ref: '#/components/schemas/MarketSnapshot'
    big_idea_section:
      $ref: '#/components/schemas/BigIdeaSection'
    product:
      $ref: '#/components/schemas/ProductInfo'
    pain_desire:
      $ref: '#/components/schemas/PainDesireSection'
    failed_solutions:
      $ref: '#/components/schemas/FailedSolutionsSection'
    competitor_landscape:
      $ref: '#/components/schemas/CompetitorLandscape'
    belief_architecture:
      $ref: '#/components/schemas/BeliefArchitecture'
    objections_section:
      $ref: '#/components/schemas/ObjectionsSection'
    research_inspiration:
      $ref: '#/components/schemas/ResearchInspiration'
    # ... legacy fields if kept in Pydantic ...
```

### Post-Implementation Checklist
- [x] Verify YAML syntax.
- [x] Ensure all `$ref` pointers exist.

