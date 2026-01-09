# US_15: Generate Offer Brief

**Status:** ✅ COMPLETED
**Created:** 2026-01-09
**Complexity:** S

---

## Problem Statement
The current pipeline generates avatars and marketing angles but is missing a high-level "Offer Brief" that synthesizes the strategy. The `OfferBrief` data model exists but is not currently populated or used. The user wants this to be generated within the `process_job_v2` Lambda function and included in the final output.

## Success Criteria
- [x] Implement `create_offer_brief` method in `DeepCopy` class in `handler.py`.
- [x] Method correctly prompts LLM to generate `OfferBrief` based on Deep Research and Marketing Avatars.
- [x] Call `create_offer_brief` in `run_pipeline` (likely after marketing angles).
- [x] Include `offer_brief` in the final dictionary saved to S3 and returned.
- [x] `OfferBrief` adheres to the Pydantic model defined in `data_models.py`.

---

## Research Summary
### Files Identified
| File | Lines | Purpose | Relevance |
|------|-------|---------|-----------|
| `cdk/lib/lambdas/process_job_v2/data_models.py` | 270-352 | Defines `OfferBrief` model | PRIMARY - Target Structure |
| `cdk/lib/lambdas/process_job_v2/handler.py` | 340-1619 | `DeepCopy` class methods | PRIMARY - Add method here |
| `cdk/lib/lambdas/process_job_v2/handler.py` | 1620-1892 | `run_pipeline` logic | PRIMARY - Integrate method here |

### Code Flow
Currently:
1. Analyze Page
2. Create Deep Research Prompt
3. Execute Deep Research
4. Identify & Complete Avatars (Parallel)
5. Generate Marketing Angles (Parallel)
6. Summary
7. Save Results

New Flow:
...
5. Generate Marketing Angles
**6. Generate Offer Brief (NEW)**
7. Summary
8. Save Results

### Dependencies
- `OfferBrief` model is already imported implicitly if `data_models` imports are updated or checked. `from data_models import Avatar, IdentifiedAvatarList, AvatarMarketingAngles` is current import line. Need to add `OfferBrief`.

---

## Implementation Plan

### Pre-Implementation Checklist
- [x] Create branch `feature/US_15_offer_brief_generation`.
- [x] Ensure `OfferBrief` is imported.

### Tasks

#### Task 1: Update Imports
**File:** `cdk/lib/lambdas/process_job_v2/handler.py`
**Lines:** ~31
**Description:** Import `OfferBrief` from `data_models`.

**Current Code:**
```python
from data_models import Avatar, IdentifiedAvatarList, AvatarMarketingAngles
```

**Target Code:**
```python
from data_models import Avatar, IdentifiedAvatarList, AvatarMarketingAngles, OfferBrief
```

#### Task 2: Add `create_offer_brief` Method
**File:** `cdk/lib/lambdas/process_job_v2/handler.py`
**Lines:** Insert before `create_summary` (~1503) or after `generate_marketing_angles`.
**Description:** Implement the method to call the LLM and parse `OfferBrief`.

**Target Code:**
```python
    def create_offer_brief(self, marketing_avatars_list, deep_research_output):
        """Generate a strategic Offer Brief based on avatars and research"""
        try:
            prompt = f"""
            OFFER BRIEF GENERATION
            ... (Detailed Prompt) ...
            
            Inputs:
            Marketing Avatars: {marketing_avatars_list}
            Deep Research: {deep_research_output}
            """
            
            # ... LLM Call using response.parse(OfferBrief) ...
            # ... Emit Usage Event ...
            
            return response.output_parsed
        except Exception as e:
            # ... Error Handling ...
```

#### Task 3: Integrate into Pipeline
**File:** `cdk/lib/lambdas/process_job_v2/handler.py`
**Lines:** Inside `run_pipeline`, ~1781 (before summary creation).
**Description:** Call the new method.

**Target Code:**
```python
        # Step 5b: Generate Offer Brief (New Step)
        logger.info("Step 5b: Generating Offer Brief")
        offer_brief = generator.create_offer_brief(marketing_avatars_list, deep_research_output)
```

**Validation:**
- Check imports.
- Check method definition.
- Check call in pipeline.

### Post-Implementation Checklist
- [x] Code syntax check.
- [x] Verify `offer_brief` is added to `all_results`.

---

## Testing Strategy
- Since this is Python code in Lambda, we can't easily run it locally without full mock setup.
- Reliance on Code Checks:
    - Ensure correct Pydantic model usage.
    - Ensure correct LLM invocation syntax (`client.responses.parse`).
    - Ensure correct variable passing.

## Out of Scope
- Modifying the `OfferBrief` data model itself.
- Changing Deep Research logic.
