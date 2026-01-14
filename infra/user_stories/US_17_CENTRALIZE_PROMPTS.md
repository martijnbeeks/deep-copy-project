# US_17: Centralize Prompts for process_job_v2 Lambda

**Status:** � READY
**Created:** 2026-01-14
**Complexity:** M

---

## Role
**Role:** Backend Developer

---

## Context
The `process_job_v2` Lambda handler (`handler.py`) contains **8+ large inline prompts** embedded directly within method bodies. These prompts are critical for the AI pipeline's behavior but are:
- Scattered across ~2000 lines of code
- Difficult to locate, review, and iterate on
- Mixed with business logic, creating cognitive load
- Not versioned or structured independently
- Hard to compare side-by-side or reuse

As the product evolves, prompt engineering will become a primary iteration surface. Having prompts buried in code slows down experimentation and introduces risk when editing Python logic.

---

## Goal
Extract all prompts from `handler.py` into a dedicated `prompts.py` module (or similar central structure). Each method in `DeepCopy` should retrieve its prompt from this central location, keeping the handler focused on orchestration and LLM invocation logic. This enables:
- Single location for all prompt content
- Easier prompt review, A/B testing, and versioning
- Cleaner separation of concerns
- Future extensibility (e.g., loading prompts from S3, databases, or configuration)

---

## Dependency
- `None`

---

## Current Implementation

### File: `cdk/lib/lambdas/process_job_v2/handler.py`

**Prompts are inline within the following methods:**

| Method | Line Range | Prompt Purpose |
|--------|------------|----------------|
| `analyze_research_page` | ~445-480 | Analyze sales page content |
| `create_deep_research_prompt` | ~548-820 | Comprehensive deep research instructions |
| `identify_avatars` | ~867-930 | Extract distinct avatars from research |
| `complete_avatar_details` | ~940-955 | Fill out avatar sheet template |
| `complete_necessary_beliefs_for_avatar` | ~994-1210 | Belief transformation framework |
| `generate_marketing_angles` | ~1223-1495 | Angle generation for avatars |
| `create_offer_brief` | ~1510-1590 | Strategic offer brief synthesis |
| `create_summary` | ~1612-1655 | Final summary of outputs |

**Example of current inline prompt (identify_avatars, lines 867-930):**
```python
def identify_avatars(self, deep_research_output):
    """Identify potential avatars from research output"""
    try:
        prompt = f"""
        Now you must identify the DISTINCT AVATARS within this research — not invented 
        personas, but real segments that emerged from the language patterns. These are 
        people who experience the same problem but from different life circumstances, 
        with different emotional drivers, and different buying psychology.
        
        Extract 3-5 distinct avatars from the research based on patterns in how 
        different people experience, describe, and seek solutions for this problem.
        ...
        
        Deep research output:
        {deep_research_output}
        """
        # ... LLM call logic ...
```

**Issues:**
1. Prompts are multi-hundred line f-strings buried in method bodies
2. No clear separation between prompt content and execution logic
3. No central index of what prompts exist
4. Difficult to perform prompt QA or version control

---

## Desired Implementation

### Structural Outcome
Create a new file `cdk/lib/lambdas/process_job_v2/prompts.py` containing:
1. **Prompt templates** as constants or functions that accept required variables
2. **Clear naming convention**: `PROMPT_{METHOD_NAME}` or `get_{method_name}_prompt(...)`
3. **Documentation** for each prompt explaining its purpose and required inputs

### Handler Changes
- Each method in `handler.py` will import and call the appropriate prompt function
- Methods will pass required context variables (e.g., `deep_research_output`, `avatar`)
- Handler methods will focus on LLM invocation, error handling, and logging

### Example Target Code Structure

**prompts.py:**
```python
"""
Central prompt repository for process_job_v2 Lambda.
All LLM prompts are defined here for maintainability and versioning.
"""

def get_identify_avatars_prompt(deep_research_output: str) -> str:
    """
    Generate prompt for identifying distinct avatars from research.
    
    Args:
        deep_research_output: The raw deep research document
        
    Returns:
        Formatted prompt string
    """
    return f"""
    Now you must identify the DISTINCT AVATARS within this research — not invented 
    personas, but real segments that emerged from the language patterns...
    
    Deep research output:
    {deep_research_output}
    """

def get_complete_avatar_details_prompt(avatar_name: str, avatar_description: str, deep_research_output: str) -> str:
    """Generate prompt for completing avatar details."""
    return f"""
    Amazing work! Now I want you to please complete the detailed Avatar sheet template...
    
    Target Avatar:
    Name: {avatar_name}
    Description: {avatar_description}
    
    Deep research output:
    {deep_research_output}
    """

# ... additional prompt functions for each method ...
```

**handler.py (updated):**
```python
from prompts import (
    get_identify_avatars_prompt,
    get_complete_avatar_details_prompt,
    # ...
)

def identify_avatars(self, deep_research_output):
    """Identify potential avatars from research output"""
    try:
        prompt = get_identify_avatars_prompt(deep_research_output)
        
        logger.info("Calling GPT-5 API to identify avatars")
        # ... LLM call logic unchanged ...
```

---

## Execution Phases

### Phase 1: Implementation (Code Written)

#### Task 1: Create `prompts.py` file
**File:** `cdk/lib/lambdas/process_job_v2/prompts.py`
**Description:** Create new file with module docstring and imports.

#### Task 2: Extract `analyze_research_page` prompt
**Source:** `handler.py` lines ~445-480
**Target:** `prompts.py` → `get_analyze_research_page_prompt(...)`

#### Task 3: Extract `create_deep_research_prompt` prompt
**Source:** `handler.py` lines ~548-820
**Target:** `prompts.py` → `get_deep_research_prompt(...)`
**Note:** This is the largest prompt (~270 lines). Parameters: `sales_page_url`, `gender`, `location`, `research_requirements`, `language_of_output`, `research_page_analysis`

#### Task 4: Extract `identify_avatars` prompt
**Source:** `handler.py` lines ~867-930
**Target:** `prompts.py` → `get_identify_avatars_prompt(...)`

#### Task 5: Extract `complete_avatar_details` prompt
**Source:** `handler.py` lines ~940-955
**Target:** `prompts.py` → `get_complete_avatar_details_prompt(...)`

#### Task 6: Extract `complete_necessary_beliefs_for_avatar` prompt
**Source:** `handler.py` lines ~994-1210
**Target:** `prompts.py` → `get_necessary_beliefs_prompt(...)`

#### Task 7: Extract `generate_marketing_angles` prompt
**Source:** `handler.py` lines ~1223-1495
**Target:** `prompts.py` → `get_marketing_angles_prompt(...)`

#### Task 8: Extract `create_offer_brief` prompt
**Source:** `handler.py` lines ~1510-1590
**Target:** `prompts.py` → `get_offer_brief_prompt(...)`

#### Task 9: Extract `create_summary` prompt
**Source:** `handler.py` lines ~1612-1655
**Target:** `prompts.py` → `get_summary_prompt(...)`

#### Task 10: Update `handler.py` imports
**File:** `handler.py`
**Description:** Add import statement for all prompt functions from `prompts.py`

#### Task 11: Refactor each method in `handler.py`
**Description:** Replace inline prompt assignment with function call to `prompts.py`

### Phase 2: Testing / Verification

#### Task 12: Syntax validation
**Command:** `cd cdk/lib/lambdas/process_job_v2 && python -m py_compile prompts.py handler.py`
**Expected:** No syntax errors

#### Task 13: Import validation
**Command:** `cd cdk/lib/lambdas/process_job_v2 && python -c "from prompts import *; from handler import DeepCopy"`
**Expected:** No import errors

#### Task 14: CDK synth validation
**Command:** `cd cdk && npx cdk synth --quiet`
**Expected:** Successful synthesis

---

## Constraints
- Do NOT modify prompt content itself — only relocate it
- Maintain backward compatibility (handler behavior unchanged)
- Do NOT introduce external dependencies
- Keep prompts as pure Python strings (no templating engines)

---

## Acceptance Criteria
- [ ] New file `prompts.py` exists in `cdk/lib/lambdas/process_job_v2/`
- [ ] All 8 prompt templates are extracted to `prompts.py` as functions
- [ ] Each prompt function has a docstring explaining purpose and parameters
- [ ] `handler.py` imports prompt functions from `prompts.py`
- [ ] Each method in `DeepCopy` calls the corresponding prompt function
- [ ] No inline `prompt = f"""..."""` blocks remain in handler methods
- [ ] `python -m py_compile` passes for both files
- [ ] CDK synthesis succeeds

---

## Files to Edit (Expected)
| File | Action |
|------|--------|
| `cdk/lib/lambdas/process_job_v2/prompts.py` | CREATE |
| `cdk/lib/lambdas/process_job_v2/handler.py` | MODIFY (imports + method refactoring) |

---

## Out of Scope
- Modifying prompt content or wording
- Adding prompt versioning or A/B testing infrastructure
- Loading prompts from external sources (S3, DynamoDB)
- Changes to data models or LLM invocation logic
- Unit test creation (separate US if needed)
